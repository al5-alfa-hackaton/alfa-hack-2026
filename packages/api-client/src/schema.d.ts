export interface paths {
    "/v1/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["createSession"];
        delete: operations["deleteSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["registerUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listCompanies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies/{companyId}/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["companyContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["currentUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analysis-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["startAnalysis"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analysis-runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getRun"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analysis-runs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancelRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analysis-runs/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description SSE: id = runId:sequence. Reconnect with Last-Event-ID or after. Polling fallback: getRun. Events are persisted; heartbeat does not imply progress. */
        get: operations["runEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies/{companyId}/analysis-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["runHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies/{companyId}/insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listInsights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getInsight"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies/{companyId}/saved-insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["savedInsights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/saved-insights/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["saveInsight"];
        post?: never;
        delete: operations["unsaveInsight"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/{id}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["updateFeedback"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/{id}/conversation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getConversation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/{id}/questions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["askQuestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/{id}/trace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["insightTrace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/documents/{documentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["readDocument"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/documents/{documentId}/pages/{pageNumber}/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["documentImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    createSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    username: string;
                    password: string;
                } | {
                    token: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        /** Format: date-time */
                        expiresAt: string;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    deleteSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": null;
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    registerUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    username: string;
                    password: string;
                    company: {
                        name: string;
                        industry: string;
                        region: string;
                        /** @default null */
                        revenue?: number | null;
                        /** @default null */
                        employees?: number | null;
                        /**
                         * @default {
                         *       "loans": null,
                         *       "leasing": null,
                         *       "deposits": null,
                         *       "payroll": null,
                         *       "factoring": null,
                         *       "settlement": null,
                         *       "guarantees": null
                         *     }
                         */
                        products?: {
                            /** @default null */
                            loans?: boolean | null;
                            /** @default null */
                            leasing?: boolean | null;
                            /** @default null */
                            deposits?: boolean | null;
                            /** @default null */
                            payroll?: boolean | null;
                            /** @default null */
                            factoring?: boolean | null;
                            /** @default null */
                            settlement?: boolean | null;
                            /** @default null */
                            guarantees?: boolean | null;
                        };
                        /** @default [] */
                        customsCountries?: string[];
                    };
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        /** Format: date-time */
                        expiresAt: string;
                        companyId: string;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    listCompanies: {
        parameters: {
            query?: {
                query?: string;
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            id: string;
                            displayName: string;
                            industry: string | null;
                            region: string | null;
                        }[];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    companyContext: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        company: {
                            id: string;
                            displayName: string;
                            industry: string | null;
                            region: string | null;
                        };
                        profileVersion: string;
                        /** @enum {string} */
                        profileSource?: "dataset" | "user";
                        corpusVersion: string;
                        /** @enum {string} */
                        dataMode: "fixture" | "research";
                        features: {
                            id: string;
                            label: string;
                            value: string | null;
                        }[];
                        gaps: string[];
                        limitations: string[];
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    currentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        companyIds: string[];
                        perspectives: ("cfo" | "ceo")[];
                        analysisAvailable: boolean;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    startAnalysis: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    companyId: string;
                    /** @enum {string} */
                    perspective: "cfo" | "ceo";
                    /** @enum {string} */
                    kind: "refresh_feed" | "question";
                    question?: string;
                    /** Format: uuid */
                    insightId?: string;
                    insightVersion?: string;
                    timeRange?: {
                        /** Format: date-time */
                        since: string;
                        /** Format: date-time */
                        until: string;
                    };
                };
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        runId: string;
                        /** @enum {string} */
                        status: "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
                        statusUrl: string;
                        eventsUrl: string;
                        /** @enum {string} */
                        dataMode: "fixture" | "research";
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    getRun: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        userId: string;
                        companyId: string;
                        /** @enum {string} */
                        perspective: "cfo" | "ceo";
                        input: {
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            /** @enum {string} */
                            kind: "refresh_feed" | "question";
                            question?: string;
                            /** Format: uuid */
                            insightId?: string;
                            insightVersion?: string;
                            timeRange?: {
                                /** Format: date-time */
                                since: string;
                                /** Format: date-time */
                                until: string;
                            };
                        };
                        /** @enum {string} */
                        status: "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                        resultIds: string[];
                        error: string | null;
                        sequence: number;
                        /** @enum {string} */
                        dataMode: "fixture" | "research";
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    cancelRun: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        userId: string;
                        companyId: string;
                        /** @enum {string} */
                        perspective: "cfo" | "ceo";
                        input: {
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            /** @enum {string} */
                            kind: "refresh_feed" | "question";
                            question?: string;
                            /** Format: uuid */
                            insightId?: string;
                            insightVersion?: string;
                            timeRange?: {
                                /** Format: date-time */
                                since: string;
                                /** Format: date-time */
                                until: string;
                            };
                        };
                        /** @enum {string} */
                        status: "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                        resultIds: string[];
                        error: string | null;
                        sequence: number;
                        /** @enum {string} */
                        dataMode: "fixture" | "research";
                    };
                };
            };
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        userId: string;
                        companyId: string;
                        /** @enum {string} */
                        perspective: "cfo" | "ceo";
                        input: {
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            /** @enum {string} */
                            kind: "refresh_feed" | "question";
                            question?: string;
                            /** Format: uuid */
                            insightId?: string;
                            insightVersion?: string;
                            timeRange?: {
                                /** Format: date-time */
                                since: string;
                                /** Format: date-time */
                                until: string;
                            };
                        };
                        /** @enum {string} */
                        status: "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                        resultIds: string[];
                        error: string | null;
                        sequence: number;
                        /** @enum {string} */
                        dataMode: "fixture" | "research";
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    runEvents: {
        parameters: {
            query?: {
                after?: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    runHistory: {
        parameters: {
            query?: {
                perspective?: "cfo" | "ceo";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            userId: string;
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            input: {
                                companyId: string;
                                /** @enum {string} */
                                perspective: "cfo" | "ceo";
                                /** @enum {string} */
                                kind: "refresh_feed" | "question";
                                question?: string;
                                /** Format: uuid */
                                insightId?: string;
                                insightVersion?: string;
                                timeRange?: {
                                    /** Format: date-time */
                                    since: string;
                                    /** Format: date-time */
                                    until: string;
                                };
                            };
                            /** @enum {string} */
                            status: "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: date-time */
                            updatedAt: string;
                            resultIds: string[];
                            error: string | null;
                            sequence: number;
                            /** @enum {string} */
                            dataMode: "fixture" | "research";
                        }[];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    listInsights: {
        parameters: {
            query?: {
                perspective?: "cfo" | "ceo";
                cursor?: string;
                limit?: number;
                kind?: "all" | "risk" | "opportunity" | "context";
                q?: string;
            };
            header?: never;
            path: {
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            version: string;
                            /** @enum {string} */
                            schemaVersion: "1";
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            /** Format: uuid */
                            runId: string;
                            /** Format: date-time */
                            generatedAt: string;
                            /** @enum {string} */
                            dataMode: "fixture" | "research";
                            profileVersion: string;
                            corpusVersion: string;
                            /** @enum {string} */
                            status: "complete" | "partial" | "insufficient_evidence";
                            /** @enum {string} */
                            kind: "risk" | "opportunity" | "context";
                            event: {
                                id: string;
                                title: string;
                                happenedAt: string | null;
                                factClaimIds: string[];
                            };
                            relevance: {
                                score: number;
                                rank: number;
                                reasons: string[];
                                version?: string;
                                components?: {
                                    companyFit: number;
                                    perspectiveFit: number;
                                    freshness: number;
                                    sourceQuality: number;
                                };
                                explanations?: {
                                    featureId: string;
                                    signal: string;
                                    weight: number;
                                }[];
                            };
                            summary: string;
                            claims: {
                                id: string;
                                /** @enum {string} */
                                kind: "fact" | "bank_position" | "ai_inference";
                                text: string;
                                evidenceIds: string[];
                                companyFeatureIds: string[];
                                uncertainty: string | null;
                            }[];
                            evidence: {
                                id: string;
                                documentId: string;
                                /** @enum {string} */
                                sourceKind: "news" | "bank";
                                quote: string;
                                publishedAt: string | null;
                                page: number | null;
                                verified: boolean;
                                /** @enum {string} */
                                contentExtent: "full_text" | "lead" | "page";
                            }[];
                            risks: string[];
                            opportunities: string[];
                            actions: string[];
                            bankPosition: {
                                /** @enum {string} */
                                status: "available" | "missing" | "stale" | "conflicting";
                                materialDates: string[];
                                claimIds: string[];
                            };
                            missingData: string[];
                            limitations: string[];
                            usage: {
                                inputTokens: number;
                                outputTokens: number;
                                cost: string | null;
                                /** @enum {string|null} */
                                currency: "RUB" | null;
                                /** @enum {string} */
                                certainty: "unknown" | "estimated";
                            };
                        }[];
                        nextCursor: string | null;
                        matchedCount: number;
                        counts: {
                            all: number;
                            risk: number;
                            opportunity: number;
                            context: number;
                        };
                        version: string | null;
                        /** @enum {string|null} */
                        dataMode: "fixture" | "research" | null;
                        limitations: string[];
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    getInsight: {
        parameters: {
            query?: {
                perspective?: "cfo" | "ceo";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        insight: {
                            /** Format: uuid */
                            id: string;
                            version: string;
                            /** @enum {string} */
                            schemaVersion: "1";
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            /** Format: uuid */
                            runId: string;
                            /** Format: date-time */
                            generatedAt: string;
                            /** @enum {string} */
                            dataMode: "fixture" | "research";
                            profileVersion: string;
                            corpusVersion: string;
                            /** @enum {string} */
                            status: "complete" | "partial" | "insufficient_evidence";
                            /** @enum {string} */
                            kind: "risk" | "opportunity" | "context";
                            event: {
                                id: string;
                                title: string;
                                happenedAt: string | null;
                                factClaimIds: string[];
                            };
                            relevance: {
                                score: number;
                                rank: number;
                                reasons: string[];
                                version?: string;
                                components?: {
                                    companyFit: number;
                                    perspectiveFit: number;
                                    freshness: number;
                                    sourceQuality: number;
                                };
                                explanations?: {
                                    featureId: string;
                                    signal: string;
                                    weight: number;
                                }[];
                            };
                            summary: string;
                            claims: {
                                id: string;
                                /** @enum {string} */
                                kind: "fact" | "bank_position" | "ai_inference";
                                text: string;
                                evidenceIds: string[];
                                companyFeatureIds: string[];
                                uncertainty: string | null;
                            }[];
                            evidence: {
                                id: string;
                                documentId: string;
                                /** @enum {string} */
                                sourceKind: "news" | "bank";
                                quote: string;
                                publishedAt: string | null;
                                page: number | null;
                                verified: boolean;
                                /** @enum {string} */
                                contentExtent: "full_text" | "lead" | "page";
                            }[];
                            risks: string[];
                            opportunities: string[];
                            actions: string[];
                            bankPosition: {
                                /** @enum {string} */
                                status: "available" | "missing" | "stale" | "conflicting";
                                materialDates: string[];
                                claimIds: string[];
                            };
                            missingData: string[];
                            limitations: string[];
                            usage: {
                                inputTokens: number;
                                outputTokens: number;
                                cost: string | null;
                                /** @enum {string|null} */
                                currency: "RUB" | null;
                                /** @enum {string} */
                                certainty: "unknown" | "estimated";
                            };
                        };
                        userState: {
                            /** Format: date-time */
                            savedAt: string | null;
                            feedback: {
                                /** @enum {string|null} */
                                rating: "useful" | "not_useful" | null;
                                comment: string;
                            };
                        };
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    savedInsights: {
        parameters: {
            query?: {
                perspective?: "cfo" | "ceo";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                companyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            version: string;
                            /** @enum {string} */
                            schemaVersion: "1";
                            companyId: string;
                            /** @enum {string} */
                            perspective: "cfo" | "ceo";
                            /** Format: uuid */
                            runId: string;
                            /** Format: date-time */
                            generatedAt: string;
                            /** @enum {string} */
                            dataMode: "fixture" | "research";
                            profileVersion: string;
                            corpusVersion: string;
                            /** @enum {string} */
                            status: "complete" | "partial" | "insufficient_evidence";
                            /** @enum {string} */
                            kind: "risk" | "opportunity" | "context";
                            event: {
                                id: string;
                                title: string;
                                happenedAt: string | null;
                                factClaimIds: string[];
                            };
                            relevance: {
                                score: number;
                                rank: number;
                                reasons: string[];
                                version?: string;
                                components?: {
                                    companyFit: number;
                                    perspectiveFit: number;
                                    freshness: number;
                                    sourceQuality: number;
                                };
                                explanations?: {
                                    featureId: string;
                                    signal: string;
                                    weight: number;
                                }[];
                            };
                            summary: string;
                            claims: {
                                id: string;
                                /** @enum {string} */
                                kind: "fact" | "bank_position" | "ai_inference";
                                text: string;
                                evidenceIds: string[];
                                companyFeatureIds: string[];
                                uncertainty: string | null;
                            }[];
                            evidence: {
                                id: string;
                                documentId: string;
                                /** @enum {string} */
                                sourceKind: "news" | "bank";
                                quote: string;
                                publishedAt: string | null;
                                page: number | null;
                                verified: boolean;
                                /** @enum {string} */
                                contentExtent: "full_text" | "lead" | "page";
                            }[];
                            risks: string[];
                            opportunities: string[];
                            actions: string[];
                            bankPosition: {
                                /** @enum {string} */
                                status: "available" | "missing" | "stale" | "conflicting";
                                materialDates: string[];
                                claimIds: string[];
                            };
                            missingData: string[];
                            limitations: string[];
                            usage: {
                                inputTokens: number;
                                outputTokens: number;
                                cost: string | null;
                                /** @enum {string|null} */
                                currency: "RUB" | null;
                                /** @enum {string} */
                                certainty: "unknown" | "estimated";
                            };
                        }[];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    saveInsight: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @default cfo
                     * @enum {string}
                     */
                    perspective?: "cfo" | "ceo";
                    version: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        savedAt: string | null;
                        feedback: {
                            /** @enum {string|null} */
                            rating: "useful" | "not_useful" | null;
                            comment: string;
                        };
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    unsaveInsight: {
        parameters: {
            query: {
                perspective?: "cfo" | "ceo";
                version: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": null;
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    updateFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @default cfo
                     * @enum {string}
                     */
                    perspective?: "cfo" | "ceo";
                    version: string;
                    /** @enum {string|null} */
                    rating: "useful" | "not_useful" | null;
                    comment: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        savedAt: string | null;
                        feedback: {
                            /** @enum {string|null} */
                            rating: "useful" | "not_useful" | null;
                            comment: string;
                        };
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    getConversation: {
        parameters: {
            query?: {
                perspective?: "cfo" | "ceo";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        conversationId: string;
                        version: string;
                        items: {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            runId: string;
                            /** @enum {string} */
                            author: "user" | "assistant";
                            text: string;
                            /** Format: date-time */
                            at: string;
                        }[];
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    askQuestion: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    perspective: "cfo" | "ceo";
                    insightVersion: string;
                    question: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        runId: string;
                        /** @enum {string} */
                        status: "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
                        statusUrl: string;
                        eventsUrl: string;
                        /** @enum {string} */
                        dataMode: "fixture" | "research";
                        conversationId: string;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    insightTrace: {
        parameters: {
            query?: {
                perspective?: "cfo" | "ceo";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            id: string;
                            /** Format: uuid */
                            runId: string;
                            sequence: number;
                            /** Format: date-time */
                            at: string;
                            type: string;
                            payload: {
                                [key: string]: unknown;
                            };
                        }[];
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    readDocument: {
        parameters: {
            query?: {
                page?: number;
                offset?: number;
                length?: number;
            };
            header?: never;
            path: {
                documentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        documentId: string;
                        title: string;
                        publishedAt: string | null;
                        /** @enum {string} */
                        sourceKind: "news" | "bank";
                        /** @enum {string} */
                        contentExtent: "page" | "lead" | "full_text";
                        page: number;
                        offset: number;
                        totalLength: number;
                        text: string;
                        externalUrl: string | null;
                    };
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
    documentImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                documentId: string;
                pageNumber: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description PNG bytes; Content-Type: image/png */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            /** @description Default Response */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
            /** @description Default Response */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        message: string;
                        requestId: string;
                        retryable: boolean;
                        /** Format: date-time */
                        resetAt?: string;
                    };
                };
            };
        };
    };
}
