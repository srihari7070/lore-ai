import { query } from '@anthropic-ai/claude-agent-sdk';

// The builder model is user-selectable in the UI; default to the balanced one.
const DEFAULT_BUILDER_MODEL = process.env.LORE_BUILDER_MODEL || 'claude-sonnet-4-6';

/**
 * Reports how the Agent SDK will authenticate. If ANTHROPIC_API_KEY is set the
 * SDK uses it (pay-as-you-go); otherwise it falls back to the user's Claude
 * subscription login (the Agent SDK credit). The API key takes precedence.
 */
export function getAuthMode() {
  return process.env.ANTHROPIC_API_KEY ? 'api-key' : 'subscription';
}

/**
 * Run the builder: hand Claude an instruction and let it edit the project
 * files directly (non-interactively) via the Agent SDK. This is the engine
 * that actually *builds the app* — distinct from the planning/compile flow.
 *
 * @param {object}   args
 * @param {string}   args.instruction  The (interpreter-produced) build instruction.
 * @param {string}   args.projectRoot  Directory the agent operates in (cwd).
 * @param {string}   [args.model]      Builder model (sonnet/opus/haiku).
 * @param {function} [args.onEvent]    Called with each streamed SDK message.
 * @returns {Promise<{ok:boolean,text:string,costUsd:number,numTurns:number,subtype:string}>}
 */
export async function runBuild({ instruction, projectRoot, model, onEvent }) {
  let result = null;

  const stream = query({
    prompt: instruction,
    options: {
      cwd: projectRoot,
      model: model || DEFAULT_BUILDER_MODEL,
      // Non-interactive: auto-approve file edits/commands so it can build
      // without prompting. The cwd scopes everything to the project.
      permissionMode: 'bypassPermissions',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
      // claude_code preset gives the file-editing agent behavior; settingSources
      // ['project'] makes it load the project's CLAUDE.md as standing context.
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      settingSources: ['project'],
    },
  });

  for await (const message of stream) {
    if (onEvent) onEvent(message);
    if (message.type === 'result') result = message;
  }

  return {
    ok: result ? !result.is_error : false,
    text: result?.result ?? '',
    costUsd: result?.total_cost_usd ?? 0,
    numTurns: result?.num_turns ?? 0,
    subtype: result?.subtype ?? 'unknown',
  };
}
