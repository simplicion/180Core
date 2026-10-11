'use strict';

import axios from 'axios';

export interface ResolvedLocation {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
    formatted: string;
}

export class LocationService {
    /**
     * Reverse geocode latitude and longitude coordinates into city and country
     */
    static async resolveCoordinates(latitude: number, longitude: number): Promise<ResolvedLocation> {
        try {
            // Fast, free, reverse geocoding via OpenStreetMap Nominatim
            const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                params: {
                    lat: latitude,
                    lon: longitude,
                    format: 'json',
                    zoom: 10
                },
                headers: {
                    'User-Agent': '180Identity/1.0 (info@180workspace.com)'
                },
                timeout: 5000
            });

            const address = response.data?.address || {};
            const city = address.city || address.town || address.village || address.state_district || address.state || '';
            const country = address.country || '';
            const formatted = [city, country].filter(Boolean).join(', ') || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;

            return {
                latitude,
                longitude,
                city,
                country,
                formatted
            };
        } catch (e: any) {
            // Graceful fallback if external lookup times out
            return {
                latitude,
                longitude,
                city: '',
                country: '',
                formatted: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
            };
        }
    }

    /**
     * Resolve approximate location (city, country, coordinates) via IP address
     */
    static async resolveFromIp(clientIp?: string): Promise<ResolvedLocation> {
        try {
            const cleanIp = (clientIp || '').trim().replace(/^::ffff:/, '');
            const isLocal = !cleanIp ||
                cleanIp === '1' ||
                cleanIp === '127.0.0.1' ||
                cleanIp === '::1' ||
                cleanIp === 'localhost' ||
                cleanIp === '0.0.0.0' ||
                cleanIp.startsWith('127.') ||
                cleanIp.startsWith('192.168.') ||
                cleanIp.startsWith('10.') ||
                cleanIp.startsWith('172.');

            const url = isLocal
                ? 'http://ip-api.com/json/?fields=status,country,city,lat,lon'
                : `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,country,city,lat,lon`;

            const response = await axios.get(url, { timeout: 4000 });
            if (response.data && response.data.status === 'success') {
                const city = response.data.city || '';
                const country = response.data.country || '';
                const lat = Number(response.data.lat) || 0;
                const lon = Number(response.data.lon) || 0;
                return {
                    latitude: lat,
                    longitude: lon,
                    city,
                    country,
                    formatted: [city, country].filter(Boolean).join(', ')
                };
            }
        } catch (_) {
            // Graceful fallback if IP api is unreachable
        }

        return {
            latitude: 0,
            longitude: 0,
            city: '',
            country: '',
            formatted: ''
        };
    }
}
