# scuri-code README

## Features

Allows running [SCURI](https://www.npmjs.com/package/scuri) ([github](https://github.com/gparlakov/scuri)) from the comfort of your beloved VS Code

## Commands

### Scuri Generate

Will generate a `.spec` file for the `.ts` file that is currently opened in the VS Code window

### Scuri Generate (overwrite)

Will generate a `.spec` file for the `.ts` file that is currently opened in the VS Code window overwriting existing spec if any.

### Scuri Update

Will update the existing `.spec` file for the `.ts` file that is currently opened in the VS Code window

### Scuri Install Dependencies

Will run `npm install --save-dev scuri @angular-devkit/schematics-cli` in the current working folder root to install requirements

## Requirements

It needs you to run the following script `npm install --save-dev scuri @angular-devkit/schematics-cli` or just run the `Scuri Install Dependencies` command from the command pallette `F1`/`Ctrl + Shift + p`

## Known Issues

## Release Notes

### 0.1.0

Initial release. Supports the basic commands Generate,Overwrite,Update and Install Dependencies
