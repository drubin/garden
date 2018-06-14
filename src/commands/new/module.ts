/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { parse, resolve } from "path"
import dedent = require("dedent")

import {
  PluginContext,
} from "../../plugin-context"
import {
  Command,
  CommandResult,
  StringParameter,
  ParameterValues,
  BooleanParameter,
} from "../base"
import { ParameterError } from "../../exceptions"
import { MODULE_PROVIDER_MAP, ModuleType } from "./configTemplates"
import { validate, existingModulePrompt, writeModuleConfig, prepareNewModuleConfig } from "./helpers"

export const newModuleOptions = {
  // BETTER NAME PLZ!
  "from-scratch": new BooleanParameter({
    help: "If true, creates a new directory. Otherwise assumes current working directory is the project directory",
  }),
  type: new StringParameter({
    help: "Type of module to help. Check out 'https://docs.garden.io' for available types",
  }),
}

export const newModuleArguments = {
  moduleName: new StringParameter({
    help: "The name of the module, (defaults to current directory name)",
  }),
}

export type Args = ParameterValues<typeof newModuleArguments>
export type Opts = ParameterValues<typeof newModuleOptions>

export class NewModuleCommand extends Command<typeof newModuleArguments, typeof newModuleOptions> {
  name = "module"
  alias = "m"
  help = "Creates scaffolding for a new Garden project."

  description = dedent`
    The New command walks the user through setting up a new Garden project and generates scaffolding based on user
    input.

    Examples:

        garden new module # scaffolds a new module in the current directory (module name defaults to directory name)
        garden new module my-module # scaffolds a new module named my-module in the current directory
  `

  runWithoutConfig = true
  arguments = newModuleArguments
  options = newModuleOptions

  async action(ctx: PluginContext, args: Args, opts: Opts): Promise<CommandResult> {
    if (opts["from-scratch"] && !args.moduleName) {
      throw new ParameterError("A module name is required if --from-scratch option is used", {})
    }

    const moduleName = validate(
      args.moduleName ? args.moduleName.trim() : parse(process.cwd()).base,
      "module",
    )

    ctx.log.header({ emoji: "house_with_garden", command: "new" })
    ctx.log.info(`Initializing new module ${moduleName}`)
    ctx.log.info("---------")

    let type: ModuleType = opts["type"]
    if (!type) {
      // Stop logger while prompting
      ctx.log.stop()
      type = (await existingModulePrompt(moduleName)).type
    } else if (!MODULE_PROVIDER_MAP[type]) {
      throw new ParameterError("Module type not available", {})
    }

    const module = prepareNewModuleConfig(moduleName, type, resolve(""))

    ctx.log.info("---------")
    await writeModuleConfig(module, ctx.log)

    return {}
  }
}
