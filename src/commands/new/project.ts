/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { parse, resolve, join } from "path"
import { pathExists, ensureDir, readdir, stat, writeFile } from "fs-extra"
import Bluebird = require("bluebird")
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
import { EntryStyle } from "../../logger/types"
import { safeDump } from "js-yaml"
import {
  newModulePrompt,
  existingModulePrompt,
  validate,
  writeModuleConfig,
  prepareNewModuleConfig,
} from "../new/helpers"
import { projectTemplate, NewModuleConfigOpts } from "../new/configTemplates"

export const newProjectOptions = {
  "module-dirs": new StringParameter({
    help: "Relative path to modules directory (if any). Use comma as a separator to specify multiple directories",
  }),
  // BETTER NAME PLZ!
  "from-scratch": new BooleanParameter({
    help: "If true, creates a new directory. Otherwise assumes current working directory is the project directory",
  }),
}

export const newProjectArguments = {
  projectName: new StringParameter({
    help: "The name of the project, (defaults to project root directory name)",
  }),
}

export type Args = ParameterValues<typeof newProjectArguments>
export type Opts = ParameterValues<typeof newProjectOptions>

export class NewProjectCommand extends Command<typeof newProjectArguments, typeof newProjectOptions> {
  name = "project"
  alias = "p"
  help = "Creates scaffolding for a new Garden project."

  description = dedent`
    The New command walks the user through setting up a new Garden project and generates scaffolding based on user
    input.

    Examples:

        garden new project # scaffolds a new Garden project in the current directory (project name defaults to
        directory name)
        garden new project my-project # scaffolds a new Garden project named my-project in the current directory
        garden new project my-existing-project --module-dirs=services # scaffolds a new Garden project and
        looks for modules in the services directory
  `

  runWithoutConfig = true
  arguments = newProjectArguments
  options = newProjectOptions

  async action(ctx: PluginContext, args: Args, opts: Opts): Promise<CommandResult> {
    let { projectRoot } = ctx
    let modulesToInitialize: NewModuleConfigOpts[] = []

    if (opts["from-scratch"] && !args.projectName) {
      throw new ParameterError("A project name is required if --from-scratch option is used", {})
    }

    const projectName = validate(
      args.projectName ? args.projectName.trim() : parse(projectRoot).base,
      "project",
    )

    if (opts["from-scratch"]) {
      projectRoot = join(projectRoot, projectName)
      await ensureDir(projectRoot)
    }

    // Directories that contain modules
    let moduleDirs: string[] | null = null
    if (!opts["from-scratch"] && opts["module-dirs"]) {
      moduleDirs = opts["module-dirs"]
        .split(",")
        .map(dir => validate(dir, "module"))
        .map(dir => resolve(projectRoot, dir))
    }

    ctx.log.header({ emoji: "house_with_garden", command: "new" })
    ctx.log.info(`Initializing new Garden project ${projectName}`)
    ctx.log.info("---------")
    // Stop logger while prompting
    ctx.log.stop()

    // If moduleDirs option provided we scan for modules in the modules parent dir(s) and add them one by one
    if (moduleDirs) {
      for (const dir of moduleDirs) {
        const exists = await pathExists(dir)
        if (!exists) {
          throw new ParameterError(`Module directory ${dir} not found`, {})
        }

        // The modules themselves
        const modulesInDir = await Bluebird.all(readdir(dir))
          .filter((moduleDirName: string) => isValidDir(join(dir, moduleDirName)))

        await Bluebird.each(modulesInDir, async moduleName => {
          const { type } = await existingModulePrompt(moduleName)
          if (type) {
            modulesToInitialize.push(prepareNewModuleConfig(moduleName, type, dir))
          }
        })
      }
    } else {
      const repeatAddModule = async (addedModules: string[] = []) => {
        let addModuleMessage
        if (addedModules.length < 1) {
          addModuleMessage = "Would you like to add a module to your project?"
        } else {
          addModuleMessage = `Add another module? (current modules: ${addedModules.join(",")})`
        }
        const { moduleName, type } = await newModulePrompt(addModuleMessage)

        if (type) {
          const dir = resolve(projectRoot)
          modulesToInitialize.push(prepareNewModuleConfig(moduleName, type, dir))
          await repeatAddModule(addedModules.concat(moduleName))
        }
      }
      await repeatAddModule()
    }

    ctx.log.info("---------")
    const projectTask = ctx.log.info({ msg: "Setting up project", entryStyle: EntryStyle.activity })

    for (const module of modulesToInitialize) {
      await writeModuleConfig(module, projectTask)
    }

    const projectYamlPath = join(projectRoot, "garden.yml")
    const moduleTypes = modulesToInitialize.map(module => module.type)
    await writeFile(projectYamlPath, safeDump(
      projectTemplate(projectName, moduleTypes),
      { noRefs: true, skipInvalid: true }),
    )

    projectTask.setSuccess()

    ctx.log.info("All set up! Be sure to check out our docs at `https://docs.garden.io`")

    return {}
  }
}

const UNIX_HIDDEN_REGEX = /(^|\/)\.[^\/\.]/g
const isValidDir = async (absPath: string): Promise<boolean> => {
  if (UNIX_HIDDEN_REGEX.test(absPath)) {
    return false
  }
  return (await stat(absPath)).isDirectory()
}
