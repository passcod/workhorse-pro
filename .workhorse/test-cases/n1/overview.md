# Word-level diff highlighting

Scenarios verifying that the Diff view marks the words that changed within a
replaced line, and only where a pair shares enough to make that meaningful.

## Word segmentation

- [x] A line edited in one spot marks the changed words on both the removed and added line and leaves the shared words unmarked (verifies spec: DIFF)
- [x] A pair of lines sharing no meaningful word carries no word-level marks and reads as changed whole (verifies spec: DIFF)
- [x] Concatenating a line's segments reproduces the line exactly, whitespace and punctuation included (verifies spec: DIFF)
- [x] A block that replaces several lines pairs them by position and marks each pair's differing words (verifies spec: DIFF)
- [x] A removed line with no added counterpart, and an added line with no removed counterpart, carry no word-level marks (verifies spec: DIFF)
- [x] A pathologically long line falls back to whole-line marking rather than running the word alignment on it (verifies spec: DIFF)

## Rendering

- [x] The Diff panel wraps the changed words of a replaced line in their own marked spans (verifies spec: DIFF)
- [x] A changed line's full text still reads back unbroken from the panel, so selection and copy are unaffected (verifies spec: DIFF)
- [ ] In the running extension the changed words show a stronger patch of the line's add or remove colour, and the line still reads as added or removed at a glance (verifies spec: DIFF)
