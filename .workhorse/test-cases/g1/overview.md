# Alphabetical workspace switcher

Scenarios verifying the ordering of the sidebar's workspace menu. Automated where the rule is pure or reachable under jsdom; manual where it needs a real browser against a live Workhorse, which is the only place React's own re-renders and the app's real markup are in play.

## The ordering rule (WSRT)

- [x] Names order alphabetically, ignoring case
- [x] Digits in a name order by value, so 2 sits before 10
- [x] Two names that order the same keep the order the app gave them

## The menu (WSRT)

- [x] An open menu is put in name order
- [x] The divider and the add-workspace control keep the end of the menu
- [x] The switcher's own trigger is not sorted into the menu
- [x] A menu already in order is left untouched rather than re-inserted
- [x] Rows are moved rather than replaced by equivalents
- [x] A row keeps its unread count, its active styling, and its link across the move
- [x] An unread count on a row does not sort as part of its name
- [x] A menu with one workspace, a closed menu, and a page with no switcher are all left alone
- [x] The `data-wh-workspace-switcher` attribute is preferred over the label fallback

## Against a live Workhorse (WSRT)

- [ ] The menu reads alphabetically on a user with several workspaces, against the app's real markup
- [ ] Clicking a row navigates to that workspace, so the app's own handling survived the move
- [ ] Tabbing through the open menu visits the rows in the order shown
- [ ] The menu stays in order while it is open and an unread count lands, which re-renders it
- [ ] Closing and reopening the menu leaves it in order
- [ ] Turning the switch off and reopening the menu shows the app's own order, without a reload
- [ ] The unread dot on the closed trigger, and the per-row counts in the open menu, read the same as without the extension
