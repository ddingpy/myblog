---
title: "OpenClaw Multi-Agent on Mac mini with Slack"
date: 2026-03-10 10:31:00 +0900
tags: [openclaw, slack, mac-mini, multi-agent, guide]
---

# OpenClaw Multi-Agent on Mac mini with Slack

Comprehensive setup and usage guide for running multiple isolated OpenClaw agents on macOS and delivering them through Slack.

Prepared: March 10, 2026

> **What this guide covers  
> **This guide explains the recommended architecture, installation steps, Slack app setup, multi-agent configuration, routing patterns, operational checks, daily usage, and troubleshooting for OpenClaw on a Mac mini. It assumes you want one always-on OpenClaw Gateway on macOS and one or more isolated agents that answer in Slack.

## 1. Recommended architecture

For a Mac mini deployment, the cleanest model is one OpenClaw Gateway process running continuously on macOS, with Slack connected as a channel and each agent defined as an isolated OpenClaw agent profile. Each agent should have its own workspace, state directory, auth store, and session history. OpenClaw’s routing bindings then decide which Slack traffic goes to which agent.

- One Gateway process on the Mac mini.
- One Slack app integration, unless you explicitly want separate Slack bot accounts.
- Multiple OpenClaw agents, each with its own workspace and personality files.
- Bindings that route Slack traffic by account, team, or exact channel/thread peer when needed.
- Per-agent sandbox and tool policies for safer public or work-facing agents.

Good fit scenarios

- A coding agent for engineering questions and a support agent for Slack help channels.
- A private deep-work agent plus a general team assistant.
- A restricted public-facing agent for shared Slack channels and a full-access personal agent for DMs.

## 2. What multi-agent means in OpenClaw

In OpenClaw, an agent is not just a prompt. It is a fully scoped runtime with its own workspace, agentDir, auth profiles, and session store. OpenClaw documents that each agent has a separate workspace, separate state directory, and sessions under ~/.openclaw/agents/\<agentId\>/sessions. It also warns not to reuse agentDir across agents because that causes auth and session collisions.

| **Component**       | **Per-agent?** | **Why it matters**                                |
|---------------------|----------------|---------------------------------------------------|
| Workspace           | Yes            | Different files, prompts, notes, and local skills |
| agentDir            | Yes            | Separate auth profiles and per-agent config       |
| Sessions            | Yes            | No context bleed between agents                   |
| Slack bindings      | Configurable   | Routes Slack traffic to the correct agent         |
| Sandbox/tool policy | Yes            | Lets you lock down riskier agents                 |

## 3. Prerequisites on the Mac mini

- macOS with terminal access and admin rights.
- Node.js 22 or newer, because the OpenClaw install docs require Node \>= 22.
- A Slack workspace where you can create or manage a Slack app.
- A model provider account for whichever model you want OpenClaw to use.
- Docker Desktop or another Docker runtime if you want sandboxed agents.
- A plan for how you want routing to work: by Slack channel, by Slack workspace, by account, or by exact conversations.

Before you start: choose one of these deployment shapes


| **Pattern**                                      | **When to use it**                       | **How routing works**                                                                     |
|--------------------------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------|
| Single Slack bot, many OpenClaw agents           | Most common on one workspace             | Bindings decide which channel or conversation goes to which agent                         |
| Multiple Slack accounts/bots, many agents        | You want visible bot separation in Slack | Each Slack account is bound to a dedicated agent or set of channels                       |
| One default agent plus one restricted specialist | You want safety with minimal complexity  | Default binding handles most traffic; specific bindings capture sensitive/public channels |

## 4. Install OpenClaw on the Mac mini

OpenClaw’s recommended install path is npm and the onboarding wizard. The official README says to install openclaw globally and run openclaw onboard --install-daemon so the Gateway stays running as a macOS launchd user service.

```
npm install -g openclaw@latest  
openclaw onboard --install-daemon
```

After onboarding, use the built-in checks before you go further.

```
openclaw doctor  
openclaw channels status --probe  
openclaw logs --follow
```

Version guidance

Use the latest stable release available to you. The public changelog currently shows OpenClaw 2026.3.3, and a recent security issue affecting localhost WebSocket authentication was reported as patched in 2026.2.25 or later. On a fresh deployment, it is sensible to update first and avoid older builds.

> openclaw update  
> openclaw doctor

## 5. Create the Slack app

The Slack guide says OpenClaw’s default Slack mode is Socket Mode. For Socket Mode, you need an App Token (xapp-...) with connections:write and a Bot Token (xoxb-...). It also recommends subscribing to message and reaction events and enabling App Home Messages for DMs.

1.  Create a Slack app in your workspace.
2.  Enable Socket Mode.
3.  Create an App Token with the connections:write scope.
4.  Install the app and copy the Bot Token.
5.  Enable App Home Messages so DMs work cleanly.
6.  Subscribe bot events including app_mention, message.channels, message.groups, message.im, message.mpim, reaction_added, reaction_removed, member_joined_channel, member_left_channel, channel_rename, pin_added, and pin_removed.

Slack scopes to include


| **Scope type**                       | **Scopes**                                                                                                                                                                      |
|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| App token                            | connections:write                                                                                                                                                               |
| Bot scopes commonly used in the docs | chat:write, channels:history, channels:read, groups:history, im:history, im:read, im:write, mpim:history, mpim:read, mpim:write, users:read, app_mentions:read, assistant:write |

If you want Slack’s assistant thread status and native text streaming behavior, OpenClaw’s docs say the app must have assistant:write and Slack Agents and AI Apps must be enabled in the app settings. A reply thread also has to exist for native streaming.

## 6. Connect Slack to OpenClaw

For the default account, OpenClaw documents this minimal Socket Mode configuration:

```
{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "xapp-...",
      botToken: "xoxb-..."
    }
  }
}
```

Environment variables can also be used for the default account.

> export SLACK_APP_TOKEN=xapp-...  
> export SLACK_BOT_TOKEN=xoxb-...

Useful first checks

> openclaw gateway  
> openclaw channels status --probe  
> openclaw channels list

## 7. Create multiple OpenClaw agents

The official multi-agent guide recommends using the agent helper to create isolated agents. Each new agent gets its own workspace, SOUL.md, AGENTS.md, optional USER.md, dedicated agentDir, and dedicated session store.

> openclaw agents add main  
> openclaw agents add dev  
> openclaw agents add support

After creating them, edit each workspace so the personas are actually different.


| **Agent** | **Suggested workspace purpose** | **Typical files to customize**              |
|-----------|---------------------------------|---------------------------------------------|
| main      | Your private default assistant  | SOUL.md, AGENTS.md, IDENTITY.md             |
| dev       | Engineering/coding assistant    | SOUL.md, AGENTS.md, local skills/           |
| support   | Public or team-facing helper    | SOUL.md, AGENTS.md, restricted tools policy |

## 8. Choose your routing model

OpenClaw routing is deterministic and most-specific wins. The official order is: exact peer match, parentPeer match, Discord guild and roles, Discord guild, Slack teamId, accountId match for a channel, channel-level match with accountId '\*', and finally the default agent. This matters because a specific Slack channel binding should appear above a broader fallback binding.

Recommended starting pattern for Slack

- Pick one default agent for all Slack traffic first.
- Add exact bindings only for channels or conversations that need a different agent.
- Keep the broad fallback last in config order.
- Do not share agentDir between agents.
- Use per-agent sandbox/tool restrictions for any agent that interacts with broader audiences.

## 9. Example configuration: one Slack workspace, three agents

This example is a practical starting point for a Mac mini on one Slack workspace. It uses one default private agent, one engineering agent for a dev channel, and one restricted support agent for a help channel. Replace placeholder IDs after resolving them from Slack.

```
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        name: "Primary Assistant",
        workspace: "~/.openclaw/workspace",
        sandbox: {
          mode: "off"
        }
      },
      {
        id: "dev",
        name: "Dev Agent",
        workspace: "~/.openclaw/workspace-dev",
        sandbox: {
          mode: "off"
        }
      },
      {
        id: "support",
        name: "Support Agent",
        workspace: "~/.openclaw/workspace-support",
        sandbox: {
          mode: "all",
          scope: "agent"
        },
        tools: {
          allow: [
            "read",
            "message",
            "sessions_list",
            "sessions_history"
          ],
          deny: [
            "exec",
            "write",
            "edit",
            "apply_patch",
            "browser",
            "canvas",
            "cron"
          ]
        }
      }
    ]
  },
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "xapp-REPLACE_ME",
      botToken: "xoxb-REPLACE_ME",
      dmPolicy: "pairing",
      dm: {
        enabled: true
      },
      streaming: "partial",
      nativeStreaming: true
    }
  },
  bindings: [
    {
      agentId: "dev",
      match: {
        channel: "slack",
        peer: {
          kind: "channel",
          id: "C_DEV_CHANNEL_ID"
        }
      }
    },
    {
      agentId: "support",
      match: {
        channel: "slack",
        peer: {
          kind: "channel",
          id: "C_HELP_CHANNEL_ID"
        }
      }
    },
    {
      agentId: "main",
      match: {
        channel: "slack",
        accountId: "*"
      }
    }
  ]
}
```

How to get Slack channel IDs

Use OpenClaw’s channel tools to resolve names and inspect available routing targets. The docs show openclaw channels resolve --channel slack '#general' '@jane' as a supported lookup pattern, and message send also supports Slack targets like channel:\<id\> or user:\<id\>.

> openclaw channels resolve --channel slack "#dev" "#help" "@yourname"

If a resolved channel name does not immediately give you the ID you need, capture it from Slack itself or from OpenClaw logs while sending a test message.

## 10. Example configuration: multiple Slack accounts or bots

OpenClaw also supports channel accounts. The channels CLI docs say interactive add can bind configured channel accounts to agents and that account-scoped bindings are first-class. This is useful when you want visible bot separation, such as one Slack app for engineering and another for support.

> {  
> agents: {  
> list: \[  
> { id: "dev", default: true, workspace: "~/.openclaw/workspace-dev" },  
> { id: "support", workspace: "~/.openclaw/workspace-support" }  
> \]  
> },  
>   
> channels: {  
> slack: {  
> enabled: true,  
> accounts: {  
> default: {  
> mode: "socket",  
> appToken: "xapp-DEV",  
> botToken: "xoxb-DEV"  
> },  
> supportbot: {  
> mode: "socket",  
> appToken: "xapp-SUPPORT",  
> botToken: "xoxb-SUPPORT"  
> }  
> }  
> }  
> },  
>   
> bindings: \[  
> { agentId: "dev", match: { channel: "slack", accountId: "default" } },  
> { agentId: "support", match: { channel: "slack", accountId: "supportbot" } }  
> \]  
> }

The CLI docs note that a binding without accountId matches only the default account, while accountId '\*' is the all-accounts fallback. That distinction is important when you scale from one Slack bot to several.

## 11. Bindings via CLI instead of hand-editing

If you prefer, use the CLI rather than editing JSON5 manually. The official agents CLI provides bindings commands.

> openclaw agents bindings  
> openclaw agents bindings --agent dev  
> openclaw agents bind --agent dev --bind slack  
> openclaw agents unbind --agent dev --all

For account-scoped binding, use the channel:account form.

> openclaw agents bind --agent support --bind slack:supportbot

## 12. Add identity and behavior per agent

Multi-agent works best when the agents are visibly different. OpenClaw supports setting identity fields such as name, theme, emoji, and avatar, and each workspace can also include an IDENTITY.md file.

> openclaw agents set-identity --agent dev --name "Dev Agent"  
> openclaw agents set-identity --agent support --name "Support Agent"

- Put concise persona and response style rules in SOUL.md.
- Put operating instructions and workflow rules in AGENTS.md.
- Keep channel-specific policies minimal and clear.
- For public agents, prefer shorter answers, fewer tools, and explicit escalation behavior.

## 13. Add sandboxing and tool restrictions

This is one of the most important parts of a production multi-agent setup. OpenClaw explicitly supports per-agent sandbox configuration and tool restrictions. Its docs show that agent-specific sandbox settings override defaults and that later tool policies can only restrict, not re-grant denied tools.

- Leave your private main agent unsandboxed only if you trust the traffic reaching it.
- Sandbox public or shared-channel agents.
- Deny write, edit, apply_patch, browser, and exec for broad-audience agents unless you truly need them.
- Use openclaw sandbox explain and gateway logs to debug why a tool is blocked.

```
{
  agents: {
    list: [
      {
        id: "support",
        workspace: "~/.openclaw/workspace-support",
        sandbox: {
          mode: "all",
          scope: "agent"
        },
        tools: {
          allow: [
            "read",
            "message"
          ],
          deny: [
            "exec",
            "write",
            "edit",
            "apply_patch",
            "browser",
            "canvas",
            "cron"
          ]
        }
      }
    ]
  }
}
```

## 14. Start, restart, and verify

After configuration changes, restart the Gateway and verify routing before inviting real users.

> openclaw gateway restart  
> openclaw agents list --bindings  
> openclaw channels status --probe  
> openclaw logs --follow

7.  Send a DM to the Slack bot and confirm the default agent responds.

8.  Mention the bot in each routed Slack channel and confirm the correct agent responds.

9.  Try a support-channel request that would need a blocked tool and confirm it is denied cleanly.

10. Watch logs for routing, sandbox, and tool policy messages.

## 15. How to use the system day to day

In Slack

- DM the bot for private conversations routed to your default agent.
- Use dedicated channels for specialist agents such as \#dev-ai or \#help-ai.
- Keep one function per channel when possible so the routing stays obvious.
- For shared channels, enable mention gating or require explicit mentions to reduce noise.

From the terminal on the Mac mini

> openclaw agent --message "Review this deployment plan" --thinking high  
> openclaw message send --channel slack --target channel:C1234567890 --message "OpenClaw test message"

The CLI is useful for smoke tests, scripted checks, and verifying that an agent itself works before debugging Slack delivery.

Operational habits that help

- Keep one workspace folder per agent and document its purpose.
- Review SOUL.md and AGENTS.md when behavior drifts.
- Use narrow bindings first and widen later.
- Run openclaw doctor after upgrades or after large config edits.

## 16. Common routing patterns


| **Pattern**                    | **Binding idea**                                                    | **Example use**                                          |
|--------------------------------|---------------------------------------------------------------------|----------------------------------------------------------|
| Default + specialist channel   | Specific peer binding for one channel, then accountId '\*' fallback | Only \#dev-ai goes to the dev agent                      |
| Workspace-wide Slack isolation | teamId binding                                                      | One Slack workspace routed to one agent                  |
| Per-bot separation             | accountId binding                                                   | Different Slack apps for support vs engineering          |
| Conversation-level override    | Exact peer binding                                                  | One sensitive channel or DM routed to a restricted agent |

## 17. Troubleshooting

No replies in Slack channels

- Check groupPolicy, channel allowlists, and requireMention.
- Verify the bot is invited to the Slack channel.
- Run openclaw channels status --probe and openclaw doctor.
- Watch openclaw logs --follow while sending a fresh test message.

DMs are ignored

- Check channels.slack.dm.enabled.
- Check channels.slack.dmPolicy. Pairing is the default safe mode.
- List and approve pending pairings when required.

> openclaw pairing list slack

Socket Mode does not connect

- Confirm Socket Mode is enabled in the Slack app.
- Confirm both xapp and xoxb tokens are correct.
- Reinstall the Slack app after scope changes if needed.

Wrong agent answers

- Review binding order: the most specific rule should appear before broader rules.
- Check whether your fallback is accountId '\*' or only the default account.
- Run openclaw agents list --bindings to confirm the effective routing table.
- Avoid ambiguous wide rules until the narrower rules are proven.

Streaming behavior looks odd

OpenClaw’s Slack docs distinguish between preview streaming and Slack native streaming. If native stream behavior is noisy or unsupported in your workspace, keep streaming partial but set nativeStreaming to false.

```
channels: {
  slack: {
    streaming: "partial",
    nativeStreaming: false
  }
}
```

## 18. Security and reliability recommendations

- Update OpenClaw before exposing it to regular Slack traffic.
- Do not reuse agentDir across agents.
- Use dmPolicy pairing unless you explicitly need open inbound DMs.
- Restrict tools for any shared-channel or public-facing agent.
- Prefer dedicated agents over complicated prompt logic when you need separation of duty.
- Treat the Mac mini as production infrastructure: keep macOS updated, use a stable user account, and monitor launchd service health.

## 19. Recommended rollout plan

11. Install OpenClaw and get one single-agent Slack integration working first.

12. Create two additional agents and customize their workspace rules.

13. Add one narrow binding for one Slack channel and verify it.

14. Add sandboxing and tool restrictions for the public-facing agent.

15. Only then add more channels, more bots, or more aggressive routing rules.

## 20. Quick command checklist

> \# install / update  
> npm install -g openclaw@latest  
> openclaw onboard --install-daemon  
> openclaw update  
> openclaw doctor  
>   
> \# channels  
> openclaw channels list  
> openclaw channels status --probe  
> openclaw channels resolve --channel slack "#dev" "@yourname"  
>   
> \# agents  
> openclaw agents add dev  
> openclaw agents add support  
> openclaw agents list --bindings  
> openclaw agents bind --agent support --bind slack:supportbot  
> openclaw agents unbind --agent support --all  
>   
> \# runtime  
> openclaw gateway  
> openclaw gateway restart  
> openclaw logs --follow  
> openclaw pairing list slack

Sources used for this guide

This guide was written against the official OpenClaw README, Slack channel guide, multi-agent routing guide, agents CLI guide, channels CLI guide, multi-agent sandbox/tools guide, configuration examples, and current public release/changelog pages as accessed on March 10, 2026.
