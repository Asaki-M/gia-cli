#!/usr/bin/env node

import { Command } from "commander"
import { analyzeAction, configAction } from "../src/commands/index.js"

const program = new Command()

program
  .name("gia")
  .version("1.0.0")
  .description("A CLI tool for analyzing issue/pr.")

program.action(analyzeAction)

program
  .command("config")
  .description("Configure GitHub Personal Access Token.")
  .option("-t, --token <token>", "GitHub Personal Access Token")
  .action(configAction)

program.parse(process.argv)
