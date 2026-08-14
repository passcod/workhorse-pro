<!-- BEGIN:workhorse 0.3.0 -->
# Workhorse framework

This workspace uses [Workhorse](https://github.com/beyondessential/workhorse), a spec-driven development workbench. Workhorse ships skills (invokable prompts) and reference docs into this repo to shape how AI agents work here.

- **Skills** live at `.agents/skills/` — each skill is a folder containing a `SKILL.md` with YAML frontmatter and a prompt body. `.claude/skills/` is a symlink to the same folder so Claude Code picks them up natively
- **Reference docs** live at `.agents/docs/` — long-form guidance that skill bodies cite by path (spec format conventions and similar)
- **Specs** live at `.workhorse/specs/` — acceptance criteria for each piece of work, organised into areas by subdirectory

When picking up a task, read the skill whose folder name matches what you're being asked to do — its `SKILL.md` describes how to approach the work and which reference docs to follow.

Workhorse keeps this section, the skills, and the reference docs current automatically: the first agent turn of a session smart-merges the latest release over your local edits, so your deliberate changes survive. Edit or remove it freely.
<!-- END:workhorse -->

# Workhorse Expert

This repo is a browser extension that overlays the Workhorse web app. It is not part of Workhorse itself — it is a separate product with its own specs, built against Workhorse's HTTP endpoints and rendered DOM.

- The Workhorse source is a sibling checkout at `../workhorse`. Read it to confirm endpoint shapes, response fields, and markup before relying on them; do not guess
- The extension is read-only with respect to the Workhorse API. It issues GETs and renders extra UI. The only writes it performs are to browser-local storage and to the app's own draft store in `localStorage`
- Firefox is the primary target. Chrome shares the source, with differences confined to the manifest

## Testing

Test approach is implementation guidance, so it lives here rather than in specs.

- `node:test`, matching Workhorse's own style. No test framework dependency
- Unit-test the pure logic: history stepping and the caret rule, stash push/pop including the swap case, check-bucket recomputation with its guards, repo and ref parsing out of GitHub URLs, check-run mapping, workspace colour derivation, preference defaults, and legacy-history adoption
- Fixture-test the DOM coupling: anchor resolution runs under jsdom against captured HTML snapshots of the real app. This is the test that earns its keep — an unmatched fallback otherwise fails silently, rendering nothing, which is the characteristic failure of the whole anchor strategy
- Test the reconcile loop under jsdom for idempotence, removal on feature disable, and the self-feeding guard
- Verify manually with `web-ext run` what cannot be tested headlessly: synthetic clicks against real React handlers, the native-setter write path, the event stream, and permission grants
