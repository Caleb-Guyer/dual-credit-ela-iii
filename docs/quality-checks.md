# Verification record

## Douglass Chapters IV–VIII

- Five real WebGL worlds, 20 story moments, 42 short lines, 30 questions and 124 bundled speech files.
- All five chapter tests walk every objective using keyboard controls; the wharf test actually gathers and delivers the sheep. Activity completion and quiz scoring are checked through the UI.
- The chapter IV challenge intentionally scores 80%, retries its missed answer to 100%, and verifies that the stored mistake clears.
- Every source reference resolves in the 45-paragraph transcript. Exact reported quotations match the source; every story line, activity, prompt and explanation has a bundled voice file.
- Phone checks exercise joystick press, movement and release, source viewing, checkpoint refresh and canceled reset. Native media playback, replay, mute, and auto-advance are exercised; all 124 MP3s are requested under the deployed repository subpath.
- Screenshot review includes all five environments and the mobile HUD. WebGL resources are released on unmount; graphics failure gives a readable recovery screen.
- Three.js and its TypeScript definitions are the added runtime/development dependencies. The local speech-generation model is not committed or loaded in the browser.

## ELA III collection and Douglass campaign

- Root and `#course` open the work selector. `#home` retains the Franklin launcher; `#douglass` opens the new campaign. Refreshes use hash navigation under the existing Pages address.
- Separate localStorage keys keep both campaigns' saves independent. Douglass resumes from the last completed story moment, validates imported browser state, and requires confirmation for reset.
- Douglass uses the complete primary transcript of Chapters I–III of the 1845 _Narrative_: 28 source paragraphs, 12 story moments, 25 short dialogue lines, and 36 multiple-choice questions.
- Every line and question has a validated chapter/paragraph reference. Exact reported speech is checked against the source. The father's identity remains uncertain; later-chapter events are not imported.
- Full browser playthrough uses actual movement controls to traverse the platformer, steer the river, navigate the first-person estate, inspect all testimonies, and reach the final challenge. It does not teleport, fabricate completion, or mutate the player state.
- A 20-question run deliberately misses one answer, verifies 95%, retries that answer, verifies 100%, and checks stored completion, all 12 memories, exam history, and cleared misses.
- Additional tests cover source viewing, mobile pointer input and release, pause, checkpoint reload, settings, canceled reset, and both campaigns' independent progress.
- Dialogue testing checks progressive reveal, speech, replay, narration mute, cancellation, and lower music volume while speaking. Voice availability still depends on the browser/device; visible text is always available.
- Geometry checks establish a traversable path to every estate objective and confirm ray and player collision at walls. Quiz checks require distinct choices and 7/7/6 chapter balance.
- The platforming route, river run, estate layout, lantern objectives, and moving veils are explicitly fictional. The original score does not claim to reproduce the historical songs.

## Source coverage

- Canonical input: `Franklin Part 1.pdf`, 27 scanned spreads, printed Part One pp. 1–53.
- Every spread rendered at 1800px and inspected visually before content authoring.
- Comprehensive per-spread outline retained in `source-outline.md`.
- 252 factual records; all appear in playable scenes and have PDF citations.
- 272 unique question IDs, 252 cards, 60 scenes/events, 12 chapter trials.
- All 27 PDF spreads represented in the factual records.
- Dialogue explicitly paraphrased; illustrative setting text separated from factual detail.
- Source uncertainties preserved, including the Courant date and the partnership dissolution date.

## Automated checks

- `npm install` completed with a committed lockfile.
- `npm run check`: TypeScript, 51 unit/data/physics/combat/speech-format/campaign tests, production build.
- Data validation checks identifiers, page bounds, references, matching pairs, chronological order, scene coverage and question coverage per chapter.
- Grading tests canonical answers, aliases, punctuation, number normalization, mistaken names, incomplete matching and incorrect chronology.
- Memory tests cover wrong-answer priority, Trouble List removal, mastery, save serialization and corrupted-data recovery.
- Repeated randomized selection verifies a balanced 20-question exam with all 12 chapters and both ordering and matching.
- End-to-end tests actually answer all story recall prompts and all twelve 10-question trials, then verify all 60 scenes, 12 chapters and 252 cards are unlocked.
- Exam test answers 18 of 20 correctly, checks 90%, saved mistakes and achievement, retries misses and reloads the save.
- UI tests exercise every major screen and 390px phone layout, scan viewing, mobile navigation and confirmed/cancelled reset.
- Additional browser flows verify all 272 Franklin questions in Everything mode, Easy recognition, timer pause/resume, flashcard flipping, collection filters and location-specific drills. Twenty-seven browser tests cover the collection, Douglass campaign, Franklin learning tools, and platformer.
- Production tests request the PDF and every scan and refresh hash routes under both `/dual-credit-ela-iii/` and `/dual-credit-ela-iii-game/`.

## Dialogue and multiple-choice checks

- All 272 questions convert deterministically to 2–4 distinct choices with exactly one accepted answer. All generated factual distractors come from the canonical bank.
- Chronology questions test the next event; relationship questions test a source-backed connection. Their original IDs, source citations and review history are preserved.
- Every fact and scene narration splits into short speech beats without dropping or rewriting words.
- Browser checks verify progressive text reveal, reveal/skip, replay, Auto/Hold, voice cancellation, stale callback isolation, saved narration preference and music ducking.
- Question tests verify spoken prompts/options, one-key scoring, immediate spoken feedback, no double scoring and no confidence step.
- A phone test disables speech support and enables reduced motion, then verifies complete readable lines, working advancement and no horizontal overflow.

## Platformer checks

- Each of the 12 levels has one NPC, two source-backed main-idea lines, one unique weapon, two combat barriers and a guardian. There are no book pickups. The complete factual bank remains in the optional study tools.
- Unit checks exercise all 12 weapon attacks, cooldowns, fast-projectile collision, crossbow piercing, boomerang return hits, enemy windups and arena clearing.
- A locked exit cannot be entered before its combat encounters are cleared.
- Simulated movement traverses the ground route of all twelve worlds without falling. Unit tests cover double jumps, variable jump height, late jumps, dash cooldown and old-save migration.
- Browser controllers clear full levels using the bow, axe, boomerang and comet staff with movement and attack inputs. They cross hazards, defeat guardians and unlock the next chapter. The extra loadout tests start with a valid unlocked save; they do not teleport during play or alter combat outcomes.
- Browser checks cover audio synthesis after Play, saved mute, keyboard and touch movement, pause, conversation dismissal, saved checkpoints and reload.
- Best times are recorded only for levels started from the beginning, so a resumed checkpoint cannot produce a misleading record.
- Platform mechanics and artwork are explicitly described as imaginative in Settings and the README; historical facts retain their source references.

## Visual review

Desktop and phone screenshots inspected for typography, contrast, clipping, spacing, navigation and answer controls. Motion is disabled in screenshot capture to inspect the completed transition. Source scans remain zoomable and selectable in the source viewer.

## Practical limits

- Franklin and Chapters I–III use installed browser/device voices; Chapters IV–VIII have bundled synthetic recordings with browser synthesis as fallback; if speech is unavailable, text and gameplay continue. Speech engine behavior is tested with controlled callbacks, and native Windows Edge voices were separately verified to start playback.
- Historical free-form scoring remains in the source-audit code and older saves; current questions use immediate multiple-choice scoring with no confidence prompt.
- The location diagram is schematic, not a geographical survey.
- Browser storage can be cleared by the browser or user. Export/import is provided.
- Hosting has been tested locally with real production output at both supported subpaths. GitHub Actions checks and deploys `main`; the current remote result is recorded in the repository's workflow history.
