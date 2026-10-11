/**
 * @180workspace/sdk
 * Official Universal Client SDK for 180 Identity (SSO/Auth) & 180 Pay (Checkout)
 * 
 * Standards: RFC 6749 (OAuth 2.0), OpenID Connect Core 1.0, RFC 7636 (PKCE S256)
 */

export * from '@workspace/identity-sdk';
export {
  OneEighty,
  OneEightyCore,
  OneEightyIdentity,
  OneEightyAuth,
  OneEightyPay,
  init180Sdk,
  load180CoreSdk,
} from '@workspace/identity-sdk';

import { OneEighty } from '@workspace/identity-sdk';
export default OneEighty;
