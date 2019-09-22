# Change Log

All notable changes to the "scuri-code" extension will be documented in this file.

## Versions

1.1.0 Add AutoSpy generation capability (limited - no path - user needs to copy the result to where they need it)

1.0.2 Stop force showing the panel on every command [issue](https://github.com/gparlakov/scuri-code/issues/7)

1.0.1 Fix [lodash vulnerability](https://github.com/lodash/lodash/pull/4336)

1.0.0 - Auto Deps Install
 1. Install dependencies globally once
    - on any command if deps not installed
    - on Scuri Install Deps command - every time (but not multiple simultaneous installs)
 2. Also update strings to match the name SCuri
 3. Show nice progress bar while installing deps as that takes time
 4. Attempt at showing the progress on the commands themselves (not working on debug...)

0.1.1 - Initial release
