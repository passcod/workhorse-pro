---
id: VIEW
---

# Remembered view selection

The toggle above an artefact chooses how it is read, and the app makes that choice for the reader on every artefact they open.
A spec opens as Changes, a plan or breakdown or test case or working doc opens as File, and a code file opens as Changes only where there is something to compare.

Those are guesses at what the reader wants, made per file type and remade on every navigation.
A reader who wants one view holds it only while they stay on one artefact, and picks it again on the next.

The view the reader chose last is remembered instead, and every artefact opened afterwards is shown in it.

## What is remembered

- [ ] Choosing a view on an artefact records it as how the reader wants artefacts read
- [ ] Opening another artefact shows it in the remembered view rather than the one the app would have chosen
- [ ] Only a view the reader chooses is recorded, so a view arrived at because the app chose it is never mistaken for a preference

Recording what the app chose would overwrite the reader's answer with a guess, and one artefact the app opened its own way would undo a preference the reader had set deliberately.

- [ ] A remembered view an artefact cannot offer leaves the app's choice standing, and stays remembered for the next artefact that can offer it

A code file with nothing to compare against offers no Changes view, so a reader who works in Changes passes through one without losing the view they came from.

## Where it does not apply

- [ ] An artefact the app gives no view toggle is left as the app renders it, and opening one disturbs nothing that is remembered
- [ ] A mockup is left alone, because the toggle above one selects a device rather than a view

## Applying it

- [ ] The remembered view is selected through the app's own control, the same way a reader selects it

Which view the app is showing lives in the app's own state rather than anywhere the extension can address, so asking for a view means asking for it as a reader would.

- [ ] The app's own choice is visible briefly before the remembered one replaces it

The app settles which view to show before it paints, and the extension acts after.
Holding the artefact hidden until the remembered view was applied would trade the flash for a blank, and a blank reads as a page still loading rather than an answer being corrected.

## The switch

- [ ] The behaviour has its own switch
- [ ] The switch starts on

Nothing is remembered until the reader picks a view, and until then the app's own choices stand untouched.
The feature is inert until a deliberate act, which is what separates it from the switches that start off.

- [ ] Turning the switch off gives the app's per-artefact choices back on the next artefact opened, without a reload
- [ ] What is remembered follows the reader across devices wherever browser sync is enabled

It is one choice rather than a body of working state, and it is the same wherever the reader works, so it belongs with the settings rather than with the history and stashed drafts held per device.

The remembered view needs no control of its own on the preferences page.
It is on screen whenever an artefact is open, as the segment reading as selected, and it is changed the same way it was set.
