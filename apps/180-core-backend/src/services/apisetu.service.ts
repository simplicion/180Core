/**
 * 180 Identity - Government of India API Setu registry client
 * Location: apps/180-core-backend/src/services/apisetu.service.ts
 *
 * Provider selection (see services/verification/config.ts):
 *   VERIFY_PROVIDER_MODE / VERIFY_APISETU_MODE = mock  -> deterministic fixtures (services/verification/mock-registry.ts)
 *                                                live  -> real API Setu gateway (consumer: com.simplicion)
 *
 * There is NO silent fallback: any live failure throws ProviderUnavailableError (HTTP 502
 * PROVIDER_UNAVAILABLE). Registry attributes are only ever taken from the registry response, never
 * from the caller's expected values.
 *
 * Live adapter request/response mapping follows the published API Setu OpenAPI specs:
 *   - Income Tax PAN verification record (Protean): POST {gateway}/pan/v3/pancr/certificate
 *       https://api.apis.guru/v2/specs/apisetu.gov.in/pan/3.0.0/openapi.json
 *   - MoRTH Driving Licence:                         POST {gateway}/transport/v3/drvlc/certificate
 *   - MoRTH Registration of Vehicles (RC):           POST {gateway}/transport/v3/rvcer/certificate
 *       https://api.apis.guru/v2/specs/apisetu.gov.in/transport/3.0.0/openapi.json
 *   (mirrors of the specs listed at https://directory.apisetu.gov.in)
 * Common contract of these "certificate" APIs:
 *   headers  X-APISETU-CLIENTID, X-APISETU-APIKEY
 *   body     { txnId: <uuid>, format: 'xml'|'pdf', certificateParameters: {...}, consentArtifact?: {...} }
 *   200      application/xml  <Certificate ...><IssuedTo><Person name dob gender swd .../></IssuedTo><CertificateData>...</CertificateData></Certificate>
 *   errors   application/json { error, errorDescription }:
 *            400 missing_parameter|invalid_parameter|invalid_format|invalid_txnid|invalid_consentid
 *            401 invalid_authentication|invalid_authorization, 404 record_not_found|url_not_found,
 *            500 internal_server_error, 502 bad_gatewy, 503 service_unavailable, 504 gateway_timeout
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { getApiSetuMode, getEnvironment } from './verification/config';
import { ProviderUnavailableError, ValidationError } from './verification/errors';
import { mockRegistry } from './verification/mock-registry';
import { maskId, maskPan } from './verification/pii';
import { isoToDdMmYyyy, toIsoDate, xmlAttributes } from './verification/xml';
import {
  panCategory,
  validateDrivingLicense,
  validateEpic,
  validateGstin,
  validatePan,
  validateVehicleRc,
} from './verification/validators';
import type {
  DrivingLicenseRecord,
  Gender,
  GstinRecord,
  IdentityRegistryProvider,
  PanRecord,
  VehicleRcRecord,
  VoterRecord,
} from './verification/types';

export type { PanRecord, DrivingLicenseRecord, VoterRecord, VehicleRcRecord, GstinRecord } from './verification/types';

function cleanEnv(v?: string): string {
  return (v || '').trim().replace(/^['"]|['"]$/g, '');
}

function mapGender(g?: string): Gender | undefined {
  const v = (g || '').trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'MALE';
  if (v === 'F' || v === 'FEMALE') return 'FEMALE';
  if (v === 'O' || v === 'T' || v === 'OTHER' || v === 'TRANSGENDER') return 'OTHER';
  return undefined;
}

function genderCode(g?: Gender): string | undefined {
  return g === 'MALE' ? 'M' : g === 'FEMALE' ? 'F' : g === 'OTHER' ? 'O' : undefined;
}

function nonEmpty(v?: string): string | undefined {
  const t = (v || '').trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Live API Setu adapter. Constructed lazily so that switching VERIFY_PROVIDER_MODE does not
 * require credentials while in mock mode.
 */
export class ApiSetuLiveAdapter implements IdentityRegistryProvider {
  private client: AxiosInstance;

  constructor() {
    const clientId = cleanEnv(process.env.APISETU_CLIENT_ID);
    const apiKey = cleanEnv(process.env.APISETU_API_KEY);
    // APISETU_BASE_URL is the gateway root (https://apisetu.gov.in). A legacy "/api/v1" suffix is ignored:
    // every publisher has its own versioned base path (e.g. /pan/v3, /transport/v3).
    const base = (cleanEnv(process.env.APISETU_BASE_URL) || 'https://apisetu.gov.in').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    if (!clientId || !apiKey) {
      throw new ProviderUnavailableError('APISETU', 'API Setu live mode is enabled but APISETU_CLIENT_ID / APISETU_API_KEY are not configured.');
    }
    this.client = axios.create({
      baseURL: base,
      timeout: 15000,
      responseType: 'text',
      transformResponse: [(d) => d], // keep raw XML / JSON text
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/xml, application/json',
        'X-APISETU-CLIENTID': clientId,
        'X-APISETU-APIKEY': apiKey,
      },
      validateStatus: () => true,
    });
  }

  /**
   * POSTs a certificate request. Returns the XML body on 200, null on 404 record_not_found,
   * throws ProviderUnavailableError on anything else. Never logs request parameters.
   */
  private async fetchCertificate(path: string, certificateParameters: Record<string, string | undefined>, label: string): Promise<{ xml: string; txnId: string } | null> {
    const txnId = crypto.randomUUID();
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(certificateParameters)) if (v !== undefined) params[k] = v;
    // TODO(api-setu-subscription): confirm whether a signed consentArtifact (ConsentArtifactSchema:
    // consent{consentId,timestamp,dataConsumer,dataProvider,purpose,user,data,permission} + signature)
    // is mandatory for our consumer. It is optional in the published spec, so it is omitted for now.
    let res;
    try {
      res = await this.client.post(path, { txnId, format: 'xml', certificateParameters: params });
    } catch (err: any) {
      throw new ProviderUnavailableError('APISETU', `${label}: API Setu request failed (${err?.code || err?.message || 'network error'}).`);
    }
    const body = typeof res.data === 'string' ? res.data : String(res.data ?? '');
    if (res.status === 200 && /<\s*(?:[A-Za-z0-9_]+:)?Certificate[\s>]/i.test(body)) {
      return { xml: body, txnId };
    }
    let errCode: string | undefined;
    try {
      errCode = JSON.parse(body)?.error;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 404 && (errCode === 'record_not_found' || !errCode)) return null;
    console.warn(`[ApiSetu] ${label} upstream status=${res.status} error=${errCode || 'n/a'} txnId=${txnId}`);
    throw new ProviderUnavailableError('APISETU', `${label}: API Setu returned ${res.status}${errCode ? ` (${errCode})` : ''}.`, {
      upstreamStatus: res.status,
      upstreamCode: errCode,
    });
  }

  async verifyPan(input: { pan: string; name?: string; dob?: string; gender?: Gender; uid?: string }): Promise<PanRecord> {
    // Spec: certificateParameters { panno, PANFullName, FullName, DOB (DD-MM-YYYY), GENDER (M|F|O), UID } - all required.
    // TODO(api-setu-subscription): confirm UID (full Aadhaar) is really mandatory for our consumer; we
    // never retain full Aadhaar numbers, so it is only sent when the caller passes it for this request.
    const found = await this.fetchCertificate(
      '/pan/v3/pancr/certificate',
      {
        panno: input.pan,
        PANFullName: input.name,
        FullName: input.name,
        DOB: isoToDdMmYyyy(input.dob),
        GENDER: genderCode(input.gender),
        UID: input.uid,
      },
      'PAN'
    );
    const base = { provider: 'APISETU' as const, environment: getEnvironment(), panMasked: maskPan(input.pan), category: panCategory(input.pan) };
    if (!found) return { ...base, found: false };
    const person = xmlAttributes(found.xml, 'Person') || {};
    const cert = xmlAttributes(found.xml, 'Certificate') || {};
    const name = nonEmpty(person.name);
    const dob = toIsoDate(person.dob);
    return {
      ...base,
      txnId: found.txnId,
      found: true,
      name,
      dob,
      gender: mapGender(person.gender),
      fatherName: nonEmpty(person.swd),
      // TODO(api-setu-subscription): confirm Certificate@status values for PAN (assumed active unless stated otherwise).
      status: /deactiv|delet|fake|inoperative/i.test(cert.status || '') ? 'DEACTIVATED' : 'VALID',
      // Issuer verified the submitted tuple; registry did not necessarily echo the attributes back.
      issuerAttested: { name: !name && Boolean(input.name), dob: !dob && Boolean(input.dob), gender: Boolean(input.gender) && !person.gender },
    };
  }

  async verifyDrivingLicense(input: { dlNumber: string; dob?: string; name?: string; uid?: string }): Promise<DrivingLicenseRecord> {
    // Spec: certificateParameters { dlno, UID, FullName, DOB (DD-MM-YYYY) } - all required.
    // TODO(api-setu-subscription): confirm UID requirement (see verifyPan).
    const found = await this.fetchCertificate(
      '/transport/v3/drvlc/certificate',
      { dlno: input.dlNumber, UID: input.uid, FullName: input.name, DOB: isoToDdMmYyyy(input.dob) },
      'DL'
    );
    const base = { provider: 'APISETU' as const, environment: getEnvironment(), dlMasked: maskId(input.dlNumber) };
    if (!found) return { ...base, found: false };
    const person = xmlAttributes(found.xml, 'Person') || {};
    const cert = xmlAttributes(found.xml, 'Certificate') || {};
    const dlData = xmlAttributes(found.xml, 'DrivingLicense') || {};
    const validTill = toIsoDate(cert.expiryDate);
    const expired = validTill ? validTill < new Date().toISOString().slice(0, 10) : false;
    const name = nonEmpty(person.name);
    const dob = toIsoDate(person.dob);
    // TODO(api-setu-subscription): confirm Certificate@status vocabulary (ACTIVE/SUSPENDED/REVOKED...).
    let status: DrivingLicenseRecord['status'] = 'ACTIVE';
    if (/suspend/i.test(cert.status || '')) status = 'SUSPENDED';
    else if (/revok|cancel/i.test(cert.status || '')) status = 'REVOKED';
    else if (expired || /expir/i.test(cert.status || '')) status = 'EXPIRED';
    return {
      ...base,
      txnId: found.txnId,
      found: true,
      name,
      dob,
      gender: mapGender(person.gender),
      fatherName: nonEmpty(person.swd),
      status,
      issueDate: toIsoDate(cert.issueDate),
      validTill,
      vehicleClasses: dlData.abbreviation ? dlData.abbreviation.split(/[,\s]+/).filter(Boolean) : undefined,
      issuerAttested: { name: !name && Boolean(input.name), dob: !dob && Boolean(input.dob) },
    };
  }

  async verifyVehicleRc(input: { rcNumber: string; chassisNumber?: string; ownerName?: string; uid?: string }): Promise<VehicleRcRecord> {
    // Spec: certificateParameters { reg_no, chasis_no (sic), UID, FullName } - all required.
    const found = await this.fetchCertificate(
      '/transport/v3/rvcer/certificate',
      { reg_no: input.rcNumber, chasis_no: input.chassisNumber, UID: input.uid, FullName: input.ownerName },
      'RC'
    );
    const base = { provider: 'APISETU' as const, environment: getEnvironment(), rcMasked: maskId(input.rcNumber) };
    if (!found) return { ...base, found: false };
    const person = xmlAttributes(found.xml, 'Person') || {};
    const cert = xmlAttributes(found.xml, 'Certificate') || {};
    const vehicle = xmlAttributes(found.xml, 'Vehicle') || {};
    const insurance = xmlAttributes(found.xml, 'Insurance') || {};
    return {
      ...base,
      txnId: found.txnId,
      found: true,
      ownerName: nonEmpty(person.name),
      status: /black/i.test(cert.status || '') ? 'BLACKLISTED' : /expir/i.test(cert.status || '') ? 'EXPIRED' : 'ACTIVE',
      makerModel: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || undefined,
      fuelType: nonEmpty(vehicle.fuelDesc),
      vehicleClass: nonEmpty(vehicle.class),
      fitnessValidTill: toIsoDate(vehicle.fitTill),
      insuranceValidTill: toIsoDate(insurance.validTill),
    };
  }

  async verifyVoterId(input: { epic: string; name?: string }): Promise<VoterRecord> {
    // TODO(api-setu-subscription): confirm. No public OpenAPI spec for an Election Commission (ECI) EPIC
    // API was found on apisetu.gov.in / directory.apisetu.gov.in / APIs.guru as of 2026-11-10. The path and
    // parameters below follow the generic API Setu certificate convention and MUST be checked against
    // the spec shown in the API Setu consumer dashboard after subscription.
    const found = await this.fetchCertificate('/eci/v3/epic/certificate', { epic_no: input.epic, FullName: input.name }, 'EPIC');
    const base = { provider: 'APISETU' as const, environment: getEnvironment(), epicMasked: maskId(input.epic) };
    if (!found) return { ...base, found: false };
    const person = xmlAttributes(found.xml, 'Person') || {};
    return {
      ...base,
      txnId: found.txnId,
      found: true,
      name: nonEmpty(person.name),
      dob: toIsoDate(person.dob),
      gender: mapGender(person.gender),
      fatherName: nonEmpty(person.swd),
      status: 'ACTIVE',
    };
  }

  async verifyGstin(input: { gstin: string }): Promise<GstinRecord> {
    // TODO(api-setu-subscription): confirm. GSTN taxpayer search is distributed to GSPs; no public API Setu
    // OpenAPI spec for a GSTIN lookup was found. Path/fields below are placeholders.
    let res;
    try {
      res = await this.client.get(`/gstn/v2/taxpayers/${encodeURIComponent(input.gstin)}`, { headers: { Accept: 'application/json' } });
    } catch (err: any) {
      throw new ProviderUnavailableError('APISETU', `GSTIN: API Setu request failed (${err?.code || 'network error'}).`);
    }
    const base = { provider: 'APISETU' as const, environment: getEnvironment(), gstin: input.gstin, stateCode: input.gstin.slice(0, 2) };
    if (res.status === 404) return { ...base, found: false };
    let d: any;
    try {
      d = JSON.parse(String(res.data));
    } catch {
      d = null;
    }
    if (res.status !== 200 || !d) {
      throw new ProviderUnavailableError('APISETU', `GSTIN: API Setu returned ${res.status}.`, { upstreamStatus: res.status });
    }
    const status = String(d.sts || d.status || '').toUpperCase();
    return {
      ...base,
      found: true,
      legalName: nonEmpty(d.lgnm || d.legalName),
      tradeName: nonEmpty(d.tradeNam || d.tradeName),
      status: status.startsWith('CANC') ? 'CANCELLED' : status.startsWith('SUSP') ? 'SUSPENDED' : 'ACTIVE',
      registrationDate: toIsoDate(d.rgdt || d.registrationDate),
    };
  }
}

/**
 * Public facade: validates formats, then routes to the mock or live provider per current mode.
 */
export class ApiSetuService {
  private live: ApiSetuLiveAdapter | null = null;

  private provider(): IdentityRegistryProvider {
    if (getApiSetuMode() === 'mock') return mockRegistry;
    if (!this.live) this.live = new ApiSetuLiveAdapter();
    return this.live;
  }

  /** Test hook: forget the cached live adapter (e.g. after env changes). */
  public reset(): void {
    this.live = null;
  }

  public async verifyPan(panNumber: string, opts: { name?: string; dob?: string; gender?: Gender; uid?: string } = {}): Promise<PanRecord> {
    const check = validatePan(panNumber);
    if (!check.valid) throw new ValidationError('INVALID_DOCUMENT_NUMBER', check.reason!);
    return this.provider().verifyPan({ pan: check.normalized, ...opts });
  }

  public async verifyDrivingLicense(dlNumber: string, opts: { dob?: string; name?: string; uid?: string } = {}): Promise<DrivingLicenseRecord> {
    const check = validateDrivingLicense(dlNumber);
    if (!check.valid) throw new ValidationError('INVALID_DOCUMENT_NUMBER', check.reason!);
    return this.provider().verifyDrivingLicense({ dlNumber: check.normalized, ...opts });
  }

  public async verifyVoterId(epicNumber: string, opts: { name?: string } = {}): Promise<VoterRecord> {
    const check = validateEpic(epicNumber);
    if (!check.valid) throw new ValidationError('INVALID_DOCUMENT_NUMBER', check.reason!);
    return this.provider().verifyVoterId({ epic: check.normalized, ...opts });
  }

  public async verifyVehicleRc(rcNumber: string, opts: { chassisNumber?: string; ownerName?: string; uid?: string } = {}): Promise<VehicleRcRecord> {
    const check = validateVehicleRc(rcNumber);
    if (!check.valid) throw new ValidationError('INVALID_DOCUMENT_NUMBER', check.reason!);
    return this.provider().verifyVehicleRc({ rcNumber: check.normalized, ...opts });
  }

  public async verifyGstin(gstin: string): Promise<GstinRecord> {
    const check = validateGstin(gstin);
    if (!check.valid) throw new ValidationError('INVALID_DOCUMENT_NUMBER', check.reason!);
    return this.provider().verifyGstin({ gstin: check.normalized });
  }
}

export const apiSetuService = new ApiSetuService();
export default apiSetuService;
