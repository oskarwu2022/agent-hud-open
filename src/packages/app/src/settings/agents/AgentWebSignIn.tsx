import { invoke, isTauri } from "@tauri-apps/api/core";
import type { NativeMethod, Provider } from "@agent-hud/protocol";
import { Button } from "@agent-hud/ui/components/button";
import { Row, Section } from "../SettingsPrimitives";
import type { Translate } from "@agent-hud/ui/format";
import type { Snapshot } from "@agent-hud/protocol";

/** A quota only the vendor's site shows: the user signs in to it in Agent
 * HUD's own window, and can sign out here. Agent HUD keeps only the session
 * the window ends with, on this computer, and opens the window only when the
 * user asks. */
export function AgentWebSignIn({
  t,
  snapshot,
  source,
  action,
  perform,
  pending,
}: {
  t: Translate;
  snapshot: Snapshot;
  source: Provider;
  action: (
    method: NativeMethod,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  perform: (work: () => Promise<unknown>) => void;
  pending: boolean;
}) {
  const workbuddyAccounts =
    source.id === "workbuddy"
      ? (snapshot.accounts ?? [])
          .filter((account) => account.provider === "workbuddy")
          .map((account) => {
            const number = /account\s+(\d+)/i.exec(account.label ?? "")?.[1];
            return number ? `account-${number}` : "main";
          })
      : [];
  const web =
    source.accountStatus?.webSignIn ??
    (source.id === "workbuddy"
      ? {
          provider: "workbuddy",
          sites: [
            {
              host: "www.workbuddy.cn",
              name: "WorkBuddy",
              signedIn: workbuddyAccounts.includes("main"),
              multiAccount: true,
              accounts: [...new Set(workbuddyAccounts)].map((slot) => ({
                slot,
                signedIn: true,
              })),
            },
          ],
        }
      : null);
  if (!web?.sites.length) return null;
  const ended = source.accountStatus?.failure === "signedOut";
  return (
    <Section
      title={t("Quota sign-in")}
      footer={t(
        "This quota is shown only on the vendor's site. Sign in there in Agent HUD's own window; Agent HUD keeps that sign-in on this computer and never reads your browser's. Google may refuse to sign in inside such a window; another way the site offers works.",
      )}
    >
      {web.sites.map((site) => (
        <div key={site.host}>
          <Row
            title={site.name}
            subtitle={
              site.signedIn
                ? ended
                  ? t("Sign-in ended; sign in again")
                  : t("Signed in on {{host}}", { host: site.host })
                : t("Not signed in on {{host}}", { host: site.host })
            }
          >
            <div style={{ display: "flex", gap: 6 }}>
              {(!site.signedIn || ended) && (
                <Button
                  size="sm"
                  disabled={pending || !isTauri()}
                  onClick={() =>
                    perform(() =>
                      invoke("web_sign_in", {
                        provider: web.provider,
                        host: site.host,
                        accountSlot: "main",
                      }),
                    )
                  }
                >
                  {t("Sign in")}
                </Button>
              )}
              {site.signedIn && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    perform(() =>
                      action("web_sign_out", {
                        provider: web.provider,
                        host: site.host,
                        accountSlot: "main",
                      }),
                    )
                  }
                >
                  {t("Sign out")}
                </Button>
              )}
            </div>
          </Row>
          {site.multiAccount &&
            (() => {
              const accounts = site.accounts ?? [];
              const used = new Set(accounts.map((account) => account.slot));
              const nextSlot = [
                "main",
                ...Array.from({ length: 9 }, (_, i) => `account-${i + 2}`),
              ].find((slot) => !used.has(slot));
              return (
                <>
                  {accounts
                    .filter((account) => account.slot !== "main")
                    .map((account) => (
                      <Row
                        key={account.slot}
                        title={t("WorkBuddy account {{number}}", {
                          number: Number(account.slot.slice("account-".length)),
                        })}
                        subtitle={t("Signed in on {{host}}", {
                          host: site.host,
                        })}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            perform(() =>
                              action("web_sign_out", {
                                provider: web.provider,
                                host: site.host,
                                accountSlot: account.slot,
                              }),
                            )
                          }
                        >
                          {t("Sign out")}
                        </Button>
                      </Row>
                    ))}
                  {nextSlot && (
                    <Row
                      title={t("Add another WorkBuddy account")}
                      subtitle={t(
                        "Sign in with a different WorkBuddy account.",
                      )}
                    >
                      <Button
                        size="sm"
                        disabled={pending || !isTauri()}
                        onClick={() =>
                          perform(() =>
                            invoke("web_sign_in", {
                              provider: web.provider,
                              host: site.host,
                              accountSlot: nextSlot,
                            }),
                          )
                        }
                      >
                        {t("Add account")}
                      </Button>
                    </Row>
                  )}
                </>
              );
            })()}
        </div>
      ))}
    </Section>
  );
}
