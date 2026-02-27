import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe, mock } from "node:test";
import {
  assertUnder,
  importFresh,
  jsonBody,
  measureMs,
  repoPath,
  restoreAll,
} from "../helpers/test-runtime";

const API_BENCHMARK_MS = 200;

type RouteModule = {
  GET?: (request?: Request) => Promise<Response>;
  POST?: (request?: Request) => Promise<Response>;
};

function listRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...listRouteFiles(absolute));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      output.push(path.relative(process.cwd(), absolute).replace(/\\/g, "/"));
    }
  }

  return output.sort();
}

function makeStripeWebhookRequest(signature: string | null): Request {
  const headers = new Headers();
  if (signature) {
    headers.set("stripe-signature", signature);
  }

  return new Request("https://example.com/api/webhook/stripe", {
    method: "POST",
    headers,
    body: '{"id":"evt_1"}',
  });
}

function makeCheckoutRequest(tier: string = "pro"): Request {
  return new Request("https://example.com/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tier }),
  });
}

function makeTwilioRequest(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return new Request("https://example.com/api/webhook/twilio", {
    method: "POST",
    body: form,
  });
}

function withEnv(
  key: string,
  value: string | undefined,
  run: () => Promise<void> | void,
): Promise<void> {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;

  return Promise.resolve(run()).finally(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

describe("Web API route coverage", () => {
  test("covers every API endpoint in app/api/**/route.ts", () => {
    const discovered = listRouteFiles(repoPath("apps/web/app/api"));
    const expected = [
      "apps/web/app/api/audit/export/route.ts",
      "apps/web/app/api/checkout/route.ts",
      "apps/web/app/api/dev/enqueue-hello/route.ts",
      "apps/web/app/api/dev/health/route.ts",
      "apps/web/app/api/portal/route.ts",
      "apps/web/app/api/webhook/stripe/route.ts",
      "apps/web/app/api/webhook/twilio/route.ts",
    ];

    assert.deepEqual(discovered, expected);
  });
});

describe("Web API unit + integration + benchmark flows", () => {
  test("all endpoints: success path, failures, error logging, and latency budgets", async () => {
    const state = {
      authRole: "owner",
      authUnauthorized: false,
      pgFailure: false,
      auditError: null as Error | null,
      auditRows: [
        {
          id: "audit_1",
          createdAt: "2026-02-20T10:00:00.000Z",
          actionType: 'send,"sms"',
          policyVersion: "v1",
          success: true,
          errorMessage: null,
          leadId: "lead_1",
          conversationId: "conv_1",
          decisionJson: { note: "line\nbreak" },
          resultJson: { ok: true },
        },
      ],
      portalCustomerId: "cus_123",
      portalError: null as Error | null,
      checkoutError: null as Error | null,
      stripeSignatureError: false,
      stripePortalUrl: "https://billing.example/session_123",
      stripeCheckoutUrl: "https://checkout.example/session_456",
      stripeWebhookEvent: {
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user_1" },
            subscription: "sub_123",
            customer: "cus_123",
          },
        },
      },
      stripeWebhookDbFailure: false,
      stripeWebhookUpsertCount: 0,
      stripeCurrentSubscriptionPriceId: "price_123",
      twilioSignatureValid: true,
      twilioInboundError: null as Error | null,
      twilioInboundResult: {
        messageId: "msg_1",
        queuedJobId: "job_1",
        leadId: "lead_1",
      },
      logCalls: [] as Array<{ route: string }>,
      refCounter: 0,
    };

    const logServerError = mock.fn((route: string) => {
      state.logCalls.push({ route });
      state.refCounter += 1;
      return `ref-${state.refCounter}`;
    });
    const consoleError = mock.method(console, "error", () => {});

    class StripeMock {
      billingPortal = {
        sessions: {
          create: async () => {
            if (state.portalError) throw state.portalError;
            return { url: state.stripePortalUrl };
          },
        },
      };

      checkout = {
        sessions: {
          create: async () => {
            if (state.checkoutError) throw state.checkoutError;
            return { url: state.stripeCheckoutUrl };
          },
        },
      };

      subscriptions = {
        retrieve: async (subscriptionId: string) => ({
          id: subscriptionId,
          status: "active",
          cancel_at_period_end: false,
          canceled_at: null,
          trial_end: null,
          current_period_start: 1_706_486_400,
          current_period_end: 1_709_164_800,
          items: {
            data: [
              {
                id: "si_123",
                price: { id: state.stripeCurrentSubscriptionPriceId },
              },
            ],
          },
        }),
        update: async (subscriptionId: string, params: { items?: Array<{ price: string }> }) => {
          const nextPriceId = params.items?.[0]?.price;
          if (nextPriceId) {
            state.stripeCurrentSubscriptionPriceId = nextPriceId;
          }
          return { id: subscriptionId };
        },
      };

      webhooks = {
        constructEvent: () => {
          if (state.stripeSignatureError) {
            throw new Error("invalid stripe signature");
          }
          return state.stripeWebhookEvent as unknown;
        },
      };
    }

    const mocks = [
      consoleError,
      mock.module("server-only", { defaultExport: {} }),
      mock.module("@/lib/server-error", { namedExports: { logServerError } }),
      mock.module("@/lib/auth", {
        namedExports: {
          requireAuthContext: async () => {
            if (state.authUnauthorized) throw new Error("Unauthorized");
            return {
              userId: "user_1",
              clerkOrgId: "org_1",
              role: state.authRole,
              clerkOrgRole: state.authRole,
              devFallback: false,
            };
          },
          requireUserId: async () => {
            if (state.authUnauthorized) throw new Error("Unauthorized");
            return "user_1";
          },
        },
      }),
      mock.module("@/lib/pg", {
        namedExports: {
          pgPool: {
            query: async (sql: string) => {
              if (state.pgFailure) throw new Error("db unavailable");
              if (sql.includes("SELECT 1 AS ok")) return { rows: [{ ok: 1 }] };
              return { rows: [] };
            },
          },
        },
      }),
      mock.module("@/lib/subscription", {
        namedExports: {
          getUserSubscription: async () => ({
            subscription: state.portalCustomerId
              ? { stripe_customer_id: state.portalCustomerId }
              : null,
          }),
        },
      }),
      mock.module("@/lib/goldbot", {
        namedExports: {
          ensureOrgAndLocation: async () => ({ orgId: "org_1", locationId: "loc_1" }),
          listAuditEntriesForExport: async () => {
            if (state.auditError) throw state.auditError;
            return state.auditRows;
          },
          createInboundMessageFromWebhook: async () => {
            if (state.twilioInboundError) throw state.twilioInboundError;
            return state.twilioInboundResult;
          },
        },
      }),
      mock.module("@/lib/twilio-signature", {
        namedExports: {
          validateTwilioSignature: () => state.twilioSignatureValid,
        },
      }),
      mock.module("@/lib/supabase", {
        namedExports: {
          createServerClient: () => ({
            from: (table: string) => {
              if (table !== "user_subscriptions") {
                throw new Error(`Unexpected table: ${table}`);
              }

              return {
                upsert: async () => {
                  if (state.stripeWebhookDbFailure) throw new Error("db write failure");
                  state.stripeWebhookUpsertCount += 1;
                  return { data: null, error: null };
                },
                select: () => ({
                  eq: () => ({
                    single: async () => ({ data: { user_id: "user_1" }, error: null }),
                  }),
                }),
                update: () => ({
                  eq: async () => ({ data: null, error: null }),
                }),
              };
            },
          }),
        },
      }),
    ];

    const previousStripeOverride = (
      globalThis as typeof globalThis & { __PIPELINEIQ_TEST_STRIPE__?: unknown }
    ).__PIPELINEIQ_TEST_STRIPE__;
    (
      globalThis as typeof globalThis & { __PIPELINEIQ_TEST_STRIPE__?: unknown }
    ).__PIPELINEIQ_TEST_STRIPE__ = StripeMock;

    try {
      const enqueueRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/dev/enqueue-hello/route.ts"),
      );
      const healthRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/dev/health/route.ts"),
      );
      const auditRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/audit/export/route.ts"),
      );
      const portalRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/portal/route.ts"),
      );
      const checkoutRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/checkout/route.ts"),
      );
      const stripeWebhookRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/webhook/stripe/route.ts"),
      );
      const twilioWebhookRoute = await importFresh<RouteModule>(
        repoPath("apps/web/app/api/webhook/twilio/route.ts"),
      );

      await withEnv("NODE_ENV", "test", async () => {
        const enqueueResponse = await enqueueRoute.GET?.();
        assert.ok(enqueueResponse);
        assert.equal(enqueueResponse.status, 200);
        const payload = (await jsonBody(enqueueResponse)) as { ok: boolean; message: string };
        assert.equal(payload.ok, true);
        assert.match(payload.message, /deprecated/i);
      });

      await withEnv("NODE_ENV", "production", async () => {
        const enqueueProd = await enqueueRoute.GET?.();
        assert.ok(enqueueProd);
        assert.equal(enqueueProd.status, 404);
      });

      state.authRole = "owner";
      state.authUnauthorized = false;
      state.pgFailure = false;
      const healthy = await measureMs(() => healthRoute.GET?.());
      assert.ok(healthy.value);
      assert.equal(healthy.value.status, 200);
      assertUnder(healthy.ms, API_BENCHMARK_MS, "Health endpoint exceeded latency target");

      state.authRole = "staff";
      const healthForbidden = await healthRoute.GET?.();
      assert.ok(healthForbidden);
      assert.equal(healthForbidden.status, 403);

      state.authRole = "owner";
      state.authUnauthorized = true;
      const healthUnauthorized = await healthRoute.GET?.();
      assert.ok(healthUnauthorized);
      assert.equal(healthUnauthorized.status, 401);

      state.authUnauthorized = false;
      state.pgFailure = true;
      const healthFailure = await healthRoute.GET?.();
      assert.ok(healthFailure);
      assert.equal(healthFailure.status, 500);
      const healthFailureBody = (await jsonBody(healthFailure)) as { referenceId: string };
      assert.match(healthFailureBody.referenceId, /^ref-/);

      state.pgFailure = false;
      state.auditError = null;
      const auditResult = await measureMs(() =>
        auditRoute.GET?.(new Request("https://example.com/api/audit/export?limit=50")),
      );
      assert.ok(auditResult.value);
      assert.equal(auditResult.value.status, 200);
      const csv = await auditResult.value.text();
      assert.match(csv, /id,created_at,action_type/i);
      assert.match(csv, /"send,""sms"""/);
      assertUnder(auditResult.ms, API_BENCHMARK_MS, "Audit export endpoint exceeded latency target");

      state.auditError = new Error("Forbidden: owner role required");
      const auditForbidden = await auditRoute.GET?.(new Request("https://example.com"));
      assert.ok(auditForbidden);
      assert.equal(auditForbidden.status, 403);
      const auditForbiddenBody = (await jsonBody(auditForbidden)) as { referenceId: string };
      assert.match(auditForbiddenBody.referenceId, /^ref-/);
      state.auditError = null;

      await withEnv("STRIPE_SECRET_KEY", "sk_test", async () => {
        await withEnv("NEXT_PUBLIC_APP_URL", "https://app.pipelineiq.test", async () => {
          state.portalError = null;
          state.portalCustomerId = "cus_123";
          const portalSuccess = await measureMs(() => portalRoute.POST?.());
          assert.ok(portalSuccess.value);
          assert.equal(portalSuccess.value.status, 200);
          assertUnder(portalSuccess.ms, API_BENCHMARK_MS, "Portal endpoint exceeded latency target");

          state.portalCustomerId = "";
          const portalNoCustomer = await portalRoute.POST?.();
          assert.ok(portalNoCustomer);
          assert.equal(portalNoCustomer.status, 400);

          state.portalCustomerId = "cus_123";
          state.authUnauthorized = true;
          const portalUnauthorized = await portalRoute.POST?.();
          assert.ok(portalUnauthorized);
          assert.equal(portalUnauthorized.status, 401);
          const portalUnauthorizedBody = (await jsonBody(portalUnauthorized)) as {
            referenceId: string;
          };
          assert.match(portalUnauthorizedBody.referenceId, /^ref-/);
          state.authUnauthorized = false;
        });
      });

      await withEnv("STRIPE_SECRET_KEY", "sk_test", async () => {
        await withEnv("NEXT_PUBLIC_APP_URL", "https://app.pipelineiq.test", async () => {
          await withEnv("STRIPE_PRO_PRICE_ID", "price_123", async () => {
            state.checkoutError = null;
            const checkoutSuccess = await measureMs(() =>
              checkoutRoute.POST?.(makeCheckoutRequest("pro")),
            );
            assert.ok(checkoutSuccess.value);
            assert.equal(checkoutSuccess.value.status, 200);
            assertUnder(
              checkoutSuccess.ms,
              API_BENCHMARK_MS,
              "Checkout endpoint exceeded latency target",
            );

            state.authUnauthorized = true;
            const checkoutUnauthorized = await checkoutRoute.POST?.(
              makeCheckoutRequest("pro"),
            );
            assert.ok(checkoutUnauthorized);
            assert.equal(checkoutUnauthorized.status, 401);
            const checkoutUnauthorizedBody = (await jsonBody(checkoutUnauthorized)) as {
              referenceId: string;
            };
            assert.match(checkoutUnauthorizedBody.referenceId, /^ref-/);
            state.authUnauthorized = false;
          });
        });
      });

      await withEnv("STRIPE_SECRET_KEY", undefined, async () => {
        await withEnv("STRIPE_WEBHOOK_SECRET", undefined, async () => {
          const missingStripeConfig = await stripeWebhookRoute.POST?.(
            makeStripeWebhookRequest("sig"),
          );
          assert.ok(missingStripeConfig);
          assert.equal(missingStripeConfig.status, 500);
        });
      });

      await withEnv("STRIPE_SECRET_KEY", "sk_test", async () => {
        await withEnv("STRIPE_WEBHOOK_SECRET", "whsec_test", async () => {
          const missingSignature = await stripeWebhookRoute.POST?.(makeStripeWebhookRequest(null));
          assert.ok(missingSignature);
          assert.equal(missingSignature.status, 400);

          state.stripeSignatureError = true;
          const invalidSignature = await stripeWebhookRoute.POST?.(
            makeStripeWebhookRequest("bad"),
          );
          assert.ok(invalidSignature);
          assert.equal(invalidSignature.status, 400);
          assert.ok(consoleError.mock.callCount() > 0);
          state.stripeSignatureError = false;

          state.stripeWebhookDbFailure = false;
          state.stripeWebhookUpsertCount = 0;
          const stripeSuccess = await measureMs(() =>
            stripeWebhookRoute.POST?.(makeStripeWebhookRequest("sig")),
          );
          assert.ok(stripeSuccess.value);
          assert.equal(stripeSuccess.value.status, 200);
          assert.equal(state.stripeWebhookUpsertCount, 1);
          assertUnder(
            stripeSuccess.ms,
            API_BENCHMARK_MS,
            "Stripe webhook endpoint exceeded latency target",
          );

          state.stripeWebhookDbFailure = true;
          const stripeDbFailure = await stripeWebhookRoute.POST?.(makeStripeWebhookRequest("sig"));
          assert.ok(stripeDbFailure);
          assert.equal(stripeDbFailure.status, 500);
          const stripeDbFailureBody = (await jsonBody(stripeDbFailure)) as { referenceId: string };
          assert.match(stripeDbFailureBody.referenceId, /^ref-/);
          state.stripeWebhookDbFailure = false;
        });
      });

      await withEnv("TWILIO_VERIFY_SIGNATURE", "false", async () => {
        await withEnv("NODE_ENV", "test", async () => {
          state.twilioInboundError = null;
          const twilioSuccess = await measureMs(() =>
            twilioWebhookRoute.POST?.(
              makeTwilioRequest({ From: "+15555550101", Body: "YES", MessageSid: "SM123" }),
            ),
          );
          assert.ok(twilioSuccess.value);
          assert.equal(twilioSuccess.value.status, 200);
          assertUnder(
            twilioSuccess.ms,
            API_BENCHMARK_MS,
            "Twilio webhook endpoint exceeded latency target",
          );
        });
      });

      await withEnv("TWILIO_VERIFY_SIGNATURE", "true", async () => {
        await withEnv("TWILIO_AUTH_TOKEN", "auth_token", async () => {
          await withEnv("NODE_ENV", "test", async () => {
            state.twilioSignatureValid = false;
            const twilioInvalidSig = await twilioWebhookRoute.POST?.(
              makeTwilioRequest({ From: "+15555550101", Body: "YES", MessageSid: "SM401" }),
            );
            assert.ok(twilioInvalidSig);
            assert.equal(twilioInvalidSig.status, 401);
            state.twilioSignatureValid = true;
          });
        });
      });

      await withEnv("TWILIO_VERIFY_SIGNATURE", "false", async () => {
        await withEnv("NODE_ENV", "test", async () => {
          const twilioMissingFields = await twilioWebhookRoute.POST?.(
            makeTwilioRequest({ From: "", Body: "" }),
          );
          assert.ok(twilioMissingFields);
          assert.equal(twilioMissingFields.status, 400);

          state.twilioInboundError = new Error("No lead found for that phone number");
          const twilioNoLead = await twilioWebhookRoute.POST?.(
            makeTwilioRequest({ From: "+15555550101", Body: "YES", MessageSid: "SM404" }),
          );
          assert.ok(twilioNoLead);
          assert.equal(twilioNoLead.status, 404);
          const twilioNoLeadBody = (await jsonBody(twilioNoLead)) as { referenceId: string };
          assert.match(twilioNoLeadBody.referenceId, /^ref-/);
          state.twilioInboundError = null;
        });
      });

      const loggedRoutes = new Set(state.logCalls.map((entry) => entry.route));
      assert.ok(loggedRoutes.has("app/api/dev/health"));
      assert.ok(loggedRoutes.has("app/api/audit/export"));
      assert.ok(loggedRoutes.has("app/api/portal"));
      assert.ok(loggedRoutes.has("app/api/checkout"));
      assert.ok(loggedRoutes.has("app/api/webhook/stripe"));
      assert.ok(loggedRoutes.has("app/api/webhook/twilio"));
    } finally {
      (
        globalThis as typeof globalThis & { __PIPELINEIQ_TEST_STRIPE__?: unknown }
      ).__PIPELINEIQ_TEST_STRIPE__ = previousStripeOverride;
      restoreAll(mocks as Array<{ restore: () => void }>);
    }
  });
});
