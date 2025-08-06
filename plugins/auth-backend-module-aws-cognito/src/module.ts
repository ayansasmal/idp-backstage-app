import {
    createBackendModule,
    coreServices,
} from '@backstage/backend-plugin-api';
import {
    authProvidersExtensionPoint,
    createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * AWS Cognito authentication provider for Backstage
 * Supports OIDC authentication with JWT token verification
 */
export const authModuleAwsCognitoProvider = createBackendModule({
    pluginId: 'auth',
    moduleId: 'aws-cognito-provider',
    register(reg) {
        reg.registerInit({
            deps: {
                providers: authProvidersExtensionPoint,
                config: coreServices.rootConfig,
                logger: coreServices.logger,
            },
            async init({ providers, config, logger }) {
                providers.registerProvider({
                    providerId: 'aws-cognito',
                    factory: createOAuthProviderFactory({
                        authenticator: async (input, ctx) => {
                            const { req } = input;

                            // Extract configuration
                            const cognitoConfig = config.getConfig('auth.providers.awsCognito');
                            const userPoolId = cognitoConfig.getString('userPoolId');
                            const clientId = cognitoConfig.getString('clientId');
                            const region = cognitoConfig.getString('region');

                            // Create JWT verifier for AWS Cognito
                            const verifier = CognitoJwtVerifier.create({
                                userPoolId,
                                tokenUse: 'id',
                                clientId,
                            });

                            try {
                                // Extract token from Authorization header
                                const authHeader = req.headers.authorization;
                                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                                    throw new Error('Missing or invalid authorization header');
                                }

                                const token = authHeader.substring(7);

                                // Verify JWT token
                                const payload = await verifier.verify(token);

                                logger.info('AWS Cognito authentication successful', {
                                    userId: payload.sub,
                                    email: payload.email,
                                });

                                return {
                                    result: {
                                        fullProfile: {
                                            id: payload.sub!,
                                            username: payload['cognito:username'] || payload.email!,
                                            provider: 'aws-cognito',
                                            displayName: payload.name || payload['cognito:username'] || payload.email!,
                                            email: payload.email!,
                                            photos: payload.picture ? [{ value: payload.picture }] : undefined,
                                        },
                                        accessToken: token,
                                        refreshToken: payload.refresh_token,
                                        params: {
                                            id_token: token,
                                            scope: payload.scope || 'openid email profile',
                                            token_type: 'Bearer',
                                        },
                                    },
                                    providerInfo: {
                                        idToken: token,
                                        accessToken: token,
                                        scope: payload.scope || 'openid email profile',
                                        expiresInSeconds: payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 3600,
                                    },
                                };
                            } catch (error) {
                                logger.error('AWS Cognito authentication failed', { error: error.message });
                                throw new Error(`Authentication failed: ${error.message}`);
                            }
                        },
                        async start(input, ctx) {
                            // OAuth start - redirect to Cognito hosted UI
                            const cognitoConfig = ctx.config.getConfig('auth.providers.awsCognito');
                            const domain = cognitoConfig.getString('domain');
                            const clientId = cognitoConfig.getString('clientId');
                            const redirectUri = `${input.req.protocol}://${input.req.get('host')}/api/auth/aws-cognito/handler/frame`;

                            const authUrl = new URL(`https://${domain}/oauth2/authorize`);
                            authUrl.searchParams.set('response_type', 'code');
                            authUrl.searchParams.set('client_id', clientId);
                            authUrl.searchParams.set('redirect_uri', redirectUri);
                            authUrl.searchParams.set('scope', 'openid email profile');
                            authUrl.searchParams.set('state', input.state);

                            return {
                                url: authUrl.toString(),
                                status: 302,
                            };
                        },
                        async handler(input, ctx) {
                            // OAuth callback handler
                            const { code, state } = input.query;

                            if (!code) {
                                throw new Error('Authorization code not provided');
                            }

                            const cognitoConfig = ctx.config.getConfig('auth.providers.awsCognito');
                            const domain = cognitoConfig.getString('domain');
                            const clientId = cognitoConfig.getString('clientId');
                            const clientSecret = cognitoConfig.getString('clientSecret');
                            const redirectUri = `${input.req.protocol}://${input.req.get('host')}/api/auth/aws-cognito/handler/frame`;

                            // Exchange code for tokens
                            const tokenResponse = await fetch(`https://${domain}/oauth2/token`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                                },
                                body: new URLSearchParams({
                                    grant_type: 'authorization_code',
                                    code: code as string,
                                    redirect_uri: redirectUri,
                                }),
                            });

                            if (!tokenResponse.ok) {
                                throw new Error('Failed to exchange authorization code for tokens');
                            }

                            const tokens = await tokenResponse.json();

                            // Verify and decode ID token
                            const userPoolId = cognitoConfig.getString('userPoolId');
                            const verifier = CognitoJwtVerifier.create({
                                userPoolId,
                                tokenUse: 'id',
                                clientId,
                            });

                            const payload = await verifier.verify(tokens.id_token);

                            return {
                                providerInfo: {
                                    idToken: tokens.id_token,
                                    accessToken: tokens.access_token,
                                    refreshToken: tokens.refresh_token,
                                    scope: tokens.scope,
                                    expiresInSeconds: tokens.expires_in,
                                },
                                profile: {
                                    id: payload.sub!,
                                    username: payload['cognito:username'] || payload.email!,
                                    provider: 'aws-cognito',
                                    displayName: payload.name || payload['cognito:username'] || payload.email!,
                                    email: payload.email!,
                                    photos: payload.picture ? [{ value: payload.picture }] : undefined,
                                },
                            };
                        },
                        resolvers: {
                            /**
                             * Looks up the user by matching their email with the entity email.
                             */
                            async emailMatchingUserEntityAnnotation(info, ctx) {
                                const { profile } = info;

                                if (!profile.email) {
                                    return undefined;
                                }

                                return ctx.findCatalogUser({
                                    annotations: {
                                        'backstage.io/managed-by-location': `cognito:${profile.email}`,
                                    },
                                });
                            },

                            /**
                             * Looks up the user by matching their Cognito username.
                             */
                            async usernameMatchingUserEntityName(info, ctx) {
                                const { profile } = info;

                                if (!profile.username) {
                                    return undefined;
                                }

                                return ctx.findCatalogUser({
                                    entityRef: {
                                        kind: 'User',
                                        name: profile.username,
                                    },
                                });
                            },
                        },
                    }),
                });
            },
        });
    },
});
