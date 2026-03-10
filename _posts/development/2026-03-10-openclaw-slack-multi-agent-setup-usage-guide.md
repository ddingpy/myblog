OpenClaw + Slack on Mac mini: Multi‑Agent Setup & Usage Guide

This guide shows how to run multiple isolated OpenClaw agents on your Mac mini, and route Slack messages to the right agent automatically (multi-agent routing). It also covers day‑to‑day usage, slash commands, threading, and common troubleshooting.

⸻

1) What “multi‑agent” means in OpenClaw

In OpenClaw, a “multi‑agent” setup means:
	•	One Gateway process running on your Mac mini (the always‑on control plane).  ￼
	•	Multiple agents hosted side-by-side by that gateway.
	•	Each agent has its own:
	•	workspace (files like AGENTS.md, SOUL.md, tools notes, memory)
	•	session store (chat history + routing state)
	•	auth profiles (provider credentials)
	•	Deterministic routing chooses which agent receives an inbound message using your configured bindings.  ￼

Key file/path map (default):  ￼
	•	Config: ~/.openclaw/openclaw.json
	•	Agent dirs: ~/.openclaw/agents/<agentId>/agent
	•	Sessions: ~/.openclaw/agents/<agentId>/sessions

Important safety note:
	•	Do not reuse agentDir across agents (it causes auth/session collisions). If you want to share model/provider creds, copy auth-profiles.json into the other agent’s agentDir.  ￼
	•	A workspace is the default working directory, not a security sandbox. For real isolation, use sandboxing.  ￼

⸻

2) Before you start: baseline checks (recommended)

Confirm install requirements

OpenClaw requires Node 22+ (installer can install it), runs on macOS, and can be installed via the installer script or npm.  ￼

Verify your Gateway is healthy

Run (on your Mac mini):

openclaw gateway status
openclaw status
openclaw channels status --probe
openclaw logs --follow

These are the standard “healthy baseline” checks.  ￼

Security hygiene (strongly recommended)

OpenClaw is designed with a personal-assistant trust model (one trusted operator boundary per gateway), and warns against treating one shared gateway as a hostile multi-tenant boundary.  ￼

Run:

openclaw security audit

(And consider --deep or --fix when you’re comfortable.)  ￼

⸻

3) Pick your multi‑agent strategy for Slack

There are three common patterns:

Pattern A — One Slack App, route by channel/DM (most common)
	•	One Slack bot in your workspace.
	•	OpenClaw routes:
	•	#ops → ops agent
	•	#eng → engineering agent
	•	DMs → your personal agent
	•	This is done with bindings that match Slack “peers” (channels/DM senders).  ￼

Pattern B — Multiple Slack Apps (separate bot identities per agent)
	•	Each agent has its own Slack bot app (separate tokens).
	•	You configure Slack multi-account in channels.slack.accounts.
	•	Then bind Slack accountIds to agents (simpler routing, separate identities).

Slack supports multi-account configuration behavior and precedence rules.  ￼

Pattern C — Multiple Slack workspaces, route by workspace (teamId)
	•	If you connect multiple Slack workspaces, route “Workspace A” → agent A using teamId rules.
	•	OpenClaw routing precedence includes teamId for Slack.  ￼

This doc focuses on Pattern A (best starting point), and adds Pattern B/C as advanced options.

⸻

4) Step-by-step: create multiple agents

4.1 Create agents (wizard / CLI)

OpenClaw provides an agent helper:

openclaw agents add work
openclaw agents add ops
openclaw agents list --bindings

This creates isolated workspaces + agent directories + session stores.  ￼

4.2 Customize each agent’s “personality” and boundaries

Each workspace typically includes:
	•	SOUL.md (identity/tone/boundaries)
	•	AGENTS.md (behavior + operating instructions)
	•	TOOLS.md (environment-specific tool notes)
	•	optionally IDENTITY.md (name/theme/avatar fields)

The default workspace template documents recommended structure, including safety defaults and a suggested way to version your workspace with git.  ￼

Optional: set identity (nice in UI + Slack presence)

openclaw agents set-identity --agent work --name "Work Claw" --emoji ":briefcase:"
openclaw agents set-identity --agent ops --name "Ops Claw" --emoji ":rotating_light:"

Identity is stored in agents.list[].identity.  ￼

⸻

5) Step-by-step: Slack channel setup (Socket Mode recommended on a Mac mini)

OpenClaw’s Slack connector supports:
	•	Socket Mode (recommended for self-hosted / home NAT / no public URL)
	•	HTTP Events API mode (requires a publicly reachable endpoint)

Socket Mode needs botToken + appToken. HTTP mode needs botToken + signingSecret.  ￼

5.1 Create & configure a Slack App

You can configure your Slack app manually, or use a manifest.

Required bot events (subscribe to these):
	•	app_mention
	•	message.channels, message.groups, message.im, message.mpim
	•	reaction_added, reaction_removed
	•	member_joined_channel, member_left_channel
	•	channel_rename
	•	pin_added, pin_removed  ￼

Also:
	•	Enable App Home → Messages Tab (needed for DMs).  ￼

Typical scopes (from the OpenClaw manifest checklist):
commands, chat:write, chat:write.customize, chat:write.public, files:write,
channels:history, groups:history, im:history, mpim:history,
reactions:write, pins:write, users:read, users:read.email.  ￼

5.2 Configure OpenClaw for Slack (Socket Mode)

Edit ~/.openclaw/openclaw.json (it’s JSON5; comments/trailing commas are ok).  ￼

Minimal Slack Socket Mode config:

{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      botToken: "xoxb-***",
      appToken: "xapp-***",

      // Recommended: restrict channel behavior
      groupPolicy: "allowlist",
      channels: {
        // allowlist channels by ID or name (ID is safest)
        // "C0123ABCDEF": { requireMention: true },
      },
    },
  },
}

Notes you should know:
	•	Config tokens override env fallbacks.
	•	SLACK_BOT_TOKEN / SLACK_APP_TOKEN env fallback applies only to the default Slack account.  ￼
	•	DMs default to pairing mode (more below).  ￼

5.3 Start / restart the gateway

openclaw gateway restart
openclaw channels status --probe

￼

⸻

6) Step-by-step: enable multi-agent routing for Slack

Multi-agent routing uses bindings. Bindings are evaluated deterministically; most-specific wins, and the fallback is your default agent.  ￼

Routing precedence (simplified; relevant tiers):  ￼
	1.	peer match (exact DM/group/channel id)
…
	2.	teamId (Slack workspace)
	3.	accountId match for a channel
	4.	channel-wide match (accountId: "*")
	5.	fallback to default agent

6.1 Recommended Slack privacy setting: secure DM sessions

If more than one person can DM your bot, you should isolate DM sessions per sender to avoid context leakage. Set:

{
  session: {
    dmScope: "per-channel-peer",
  },
}

This is the recommended “secure DM mode” for multi-user inboxes.  ￼

(With this, DM session keys become agent:<agentId>:slack:dm:<peerId>-style, rather than all DMs sharing main.)  ￼

6.2 Example: one Slack bot, three agents (work / ops / personal)

Below is a realistic, copy-paste-able pattern A config skeleton. Replace the IDs:
	•	Slack channel IDs look like C… (public channels) and G… (private channels / group-ish IDs).
	•	Slack user IDs look like U… (for DM sender IDs).

{
  // 1) Secure DM mode (recommended if >1 person can DM the bot)
  session: { dmScope: "per-channel-peer" },

  // 2) Define multiple agents
  agents: {
    list: [
      { id: "personal", default: true, workspace: "~/.openclaw/workspace-personal" },
      { id: "work", workspace: "~/.openclaw/workspace-work" },
      { id: "ops", workspace: "~/.openclaw/workspace-ops" },
    ],
  },

  // 3) Route Slack messages to different agents
  // Put most-specific bindings first.
  bindings: [
    // Channel routing
    { agentId: "ops", match: { channel: "slack", peer: { kind: "channel", id: "C012OPS" } } },
    { agentId: "work", match: { channel: "slack", peer: { kind: "channel", id: "C034WORK" } } },

    // Optional: DM routing for specific people (by sender ID)
    { agentId: "work", match: { channel: "slack", peer: { kind: "direct", id: "U0WORKBOSS" } } },

    // Fallback: everything else on Slack goes to personal (default account)
    { agentId: "personal", match: { channel: "slack", accountId: "default" } },
  ],

  // 4) Slack connector config
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      botToken: "xoxb-***",
      appToken: "xapp-***",

      // Recommended for shared workspaces:
      // only respond in channels you explicitly allow.
      groupPolicy: "allowlist",
      channels: {
        C012OPS: { requireMention: true },
        C034WORK: { requireMention: true },
      },

      // DMs default to pairing; keep it unless you have a strong reason.
      dmPolicy: "pairing",
    },
  },
}

Why this works:
	•	peer bindings are the most specific (top tier), so they win over account-level fallbacks.  ￼
	•	Slack chat types map as: DMs = direct, channels = channel, MPIMs = group.  ￼
	•	Restricting Slack groupPolicy + channel allowlist prevents the bot from “being everywhere.”  ￼

6.3 Restart & verify routing

openclaw gateway restart
openclaw agents list --bindings
openclaw channels status --probe

￼

Then test by posting in each channel and confirming the correct agent responds.

⸻

7) How to use multi-agent in Slack day-to-day

7.1 Talking to the right agent

With peer-based routing:
	•	Talk in #ops → ops agent responds (subject to mention rules)
	•	Talk in #work → work agent responds
	•	DM the bot → routed by your DM rules (or fallback)

7.2 Mention gating (important in channels)

OpenClaw’s Slack channel handling is mention-gated by default. Mention sources include:  ￼
	•	explicit app mention (<@botId>)
	•	mention regex patterns (agent or global config)
	•	implicit reply-to-bot thread behavior

Practical usage:
	•	In a channel, use @YourBot … to trigger it.
	•	Or reply in the same thread the bot started (depending on your threading settings).

7.3 Threads and session behavior (highly recommended)

Slack threads can create separate session suffixes (like :thread:<threadTs>), and you can control how much history is fetched when a new thread session starts.  ￼

Key settings (optional, but useful):
	•	channels.slack.thread.historyScope (default thread)
	•	channels.slack.thread.inheritParent (default false)
	•	channels.slack.thread.initialHistoryLimit (default 20; set 0 to disable history fetch)
	•	channels.slack.replyToMode: off|first|all (default off)
	•	Manual reply tags: [[reply_to_current]] and `[[reply_to:]] (disabled if replyToMode=“off”)  ￼

7.4 DM pairing approvals (common “why isn’t it responding?” issue)

Slack DMs default to pairing mode (unknown senders get a short pairing code).  ￼

Approve a sender (from your Mac mini terminal):

openclaw pairing approve slack <code>

Pairing approval is explicitly documented for Slack.  ￼

7.5 Slash commands in Slack (two ways)

Slack treats /something as a Slack slash command, so you don’t get “text commands” for free. OpenClaw supports:

Option A — One “single slash command”
	•	If native commands are off, you can configure one Slack slash command via channels.slack.slashCommand.  ￼
	•	Default slash command settings include:
	•	enabled: false
	•	name: "openclaw"
	•	sessionPrefix: "slack:slash"
	•	ephemeral: true
	•	Slash sessions use isolated keys like agent:<agentId>:slack:slash:<userId>.  ￼

This is best if you want minimal Slack app configuration.

Option B — Native OpenClaw commands as Slack slash commands
	•	Enable native command handlers:
	•	channels.slack.commands.native: true (or global commands.native: true)  ￼
	•	Then create slash commands in Slack for the commands you want.
	•	Special case: Slack reserves /status, so register /agentstatus for OpenClaw’s status command.  ￼
	•	OpenClaw has a documented command list (help, commands, skill, status, allowlist, approve, context, export, whoami, etc.).  ￼

⸻

8) Advanced: multiple Slack accounts (multiple Slack apps) per Gateway

If you want separate bot identities (or multiple Slack workspaces), configure:
	•	channels.slack.accounts.default and one or more named accounts
	•	For HTTP mode, use unique webhookPath per account to avoid collisions.  ￼
	•	Account inheritance/precedence rules apply for allowlists, etc.  ￼
	•	Bind per account with bindings using accountId.

Bindings without accountId match default account only, and accountId:"*" is a channel-wide fallback.  ￼

⸻

9) Testing & verification workflow (recommended)

Quick “it works” checks
	1.	Gateway health:

openclaw gateway status

￼
	2.	Channel probe:

openclaw channels status --probe

￼
	3.	Agent routing visibility:

openclaw agents list --bindings
openclaw agents bindings

￼

Fire a test run from CLI

You can test an agent directly:

openclaw agent --agent ops --message "Summarize the last 20 Slack events"

And you can deliver replies to Slack with --deliver and reply routing flags.  ￼

⸻

10) Troubleshooting (Slack + multi-agent)

Problem: “Slack bot connects but never replies”

Common causes:
	•	Missing Event Subscriptions or missing required bot events.  ￼
	•	App Home Messages Tab not enabled (DMs won’t work properly).  ￼
	•	Bot not invited to the channel (Slack side).
	•	groupPolicy: "allowlist" but you forgot to allow the channel in channels.slack.channels.  ￼
	•	You didn’t mention the bot and the channel requires mention (requireMention: true).  ￼

Problem: “DMs show a code instead of responding”

That’s pairing mode. Approve it:

openclaw pairing approve slack <code>

￼

Problem: “Wrong agent responds in Slack”
	•	Binding precedence is deterministic; most-specific wins. Make sure your peer bindings appear before account-level fallbacks.  ￼
	•	Check that you’re matching the right peer.kind (direct|channel|group).  ￼
	•	Verify bindings:

openclaw agents list --bindings
openclaw agents bindings



Problem: “Multiple people DM the bot and it leaks context”

Set secure DM mode:

session: { dmScope: "per-channel-peer" }

This is explicitly recommended to avoid cross-user context leakage.  ￼

Problem: “Gateway stuck / port conflict”

The runbook recommends checking for port listeners and using --force if needed.  ￼

⸻

11) Security notes specifically for Slack multi-agent setups
	•	If “everyone in Slack can message the bot,” the core risk is delegated tool authority: anyone who can talk to an agent can potentially steer its tool usage within that agent’s policy. The official security guide calls this out explicitly for shared Slack workspaces.  ￼
	•	Keep team-facing Slack agents tool-minimal (often: no host shell, no broad filesystem).
	•	Consider sandboxing so risky tools execute in containers (reduces blast radius).  ￼
	•	Run openclaw security audit regularly.  ￼

Also: there was a recent reported vulnerability (“ClawJacked”) involving localhost gateway takeover; multiple security outlets and the researcher report recommend upgrading to a patched version (late Feb 2026 releases and later). Best practice: keep OpenClaw updated to the latest stable.  ￼

⸻

12) A quick “do this now” checklist
	1.	Create agents

openclaw agents add personal
openclaw agents add work
openclaw agents add ops

￼
	2.	Configure Slack (Socket Mode)

	•	Create Slack app with scopes + bot events + App Home Messages tab.  ￼
	•	Add channels.slack tokens in ~/.openclaw/openclaw.json.  ￼

	3.	Set DM session isolation

session: { dmScope: "per-channel-peer" }

￼
	4.	Add bindings (peer bindings first, then fallback)  ￼
	5.	Restart + probe

openclaw gateway restart
openclaw channels status --probe
openclaw agents list --bindings

￼