/**
 * Configuration interface for AWS Cognito authentication provider
 */
export interface CognitoAuthConfig {
    /** AWS Cognito User Pool ID */
    userPoolId: string;
    /** AWS Cognito App Client ID */
    clientId: string;
    /** AWS Cognito App Client Secret */
    clientSecret: string;
    /** AWS Region where the User Pool is located */
    region: string;
    /** Cognito domain for hosted UI */
    domain: string;
    /** Optional: Custom claims mapping */
    claimsMapping?: {
        displayName?: string;
        email?: string;
        username?: string;
        groups?: string;
    };
}

/**
 * User profile structure from AWS Cognito
 */
export interface CognitoUserProfile {
    /** Unique user identifier from Cognito (sub claim) */
    id: string;
    /** Username from Cognito */
    username: string;
    /** User's email address */
    email: string;
    /** Display name for the user */
    displayName: string;
    /** Profile picture URL if available */
    picture?: string;
    /** User groups from Cognito */
    groups?: string[];
    /** Custom attributes from Cognito */
    customAttributes?: Record<string, string>;
    /** Provider identifier */
    provider: 'aws-cognito';
}

/**
 * JWT payload structure from AWS Cognito ID token
 */
export interface CognitoJwtPayload {
    /** Subject (user ID) */
    sub: string;
    /** Audience (client ID) */
    aud: string;
    /** Issuer */
    iss: string;
    /** Issued at timestamp */
    iat: number;
    /** Expiration timestamp */
    exp: number;
    /** Token use */
    token_use: 'id';
    /** Authentication time */
    auth_time: number;
    /** Username */
    'cognito:username'?: string;
    /** User groups */
    'cognito:groups'?: string[];
    /** Email address */
    email?: string;
    /** Email verified flag */
    email_verified?: boolean;
    /** Given name */
    given_name?: string;
    /** Family name */
    family_name?: string;
    /** Full name */
    name?: string;
    /** Profile picture URL */
    picture?: string;
    /** Locale */
    locale?: string;
    /** Custom attributes */
    [key: string]: any;
}

/**
 * Authentication result from AWS Cognito
 */
export interface CognitoAuthResult {
    /** User profile information */
    profile: CognitoUserProfile;
    /** Provider information including tokens */
    providerInfo: {
        idToken: string;
        accessToken: string;
        refreshToken?: string;
        scope: string;
        expiresInSeconds: number;
    };
}
