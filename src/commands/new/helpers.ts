/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as inquirer from "inquirer"
import * as Joi from "joi"
import chalk from "chalk"
import {
  moduleTypeChoices,
  containerTemplate,
  functionTemplate,
  npmPackageTemplate,
  NewModuleConfigOpts,
  ModuleType,
  moduleTemplate,
} from "./configTemplates"
import { join } from "path"
import { pathExists, ensureDir, writeFile } from "fs-extra"
import { joiIdentifier } from "../../types/common"
import { ValidationError } from "../../exceptions"
import { safeDump } from "js-yaml"
import { EntryStyle } from "../../logger/types"
import { LogNode } from "../../logger"

const moduleTypeTemplates = {
  container: containerTemplate,
  function: functionTemplate,
  "npm-package": npmPackageTemplate,
}

export async function existingModulePrompt(dir: string): Promise<{ type: ModuleType }> {
  const questions: inquirer.Questions = [
    {
      name: "initModule",
      message: `Add module config for ${chalk.italic(dir)}?`,
      type: "confirm",
    },
    {
      name: "type",
      message: "Module type",
      choices: moduleTypeChoices,
      when: ans => ans.initModule,
      type: "list",
    },
  ]
  const { type } = await inquirer.prompt(questions)
  return { type }
}

export async function newModulePrompt(addModuleMessage: string): Promise<{ moduleName: string, type: ModuleType }> {
  const questions: inquirer.Questions = [
    {
      name: "addModule",
      message: addModuleMessage,
      type: "confirm",
    },
    {
      name: "moduleName",
      message: "Enter module name",
      type: "input",
      validate: input => {
        try {
          Joi.attempt(input.trim(), joiIdentifier())
        } catch (err) {
          return `Invalid module name, please try again\nError: ${err.message}`
        }
        return true
      },
      filter: input => input.trim(),
      when: ans => ans.addModule,
    },
    {
      name: "type",
      message: "Module type",
      choices: moduleTypeChoices,
      when: ans => ans.moduleName,
      type: "list",
    },
  ]
  const { moduleName, type } = await inquirer.prompt(questions)
  return { moduleName, type }
}

export function validate(name: string, context: string) {
  try {
    Joi.attempt(name, joiIdentifier())
  } catch ({ message }) {
    throw new ValidationError(`${name} is an invalid ${context} name`, { message })
  }
  return name
}

export async function writeModuleConfig(module: NewModuleConfigOpts, logNode: LogNode) {
  const moduleTask = logNode.info({
    msg: `Initializing module ${module.name}`,
    entryStyle: EntryStyle.activity,
  })
  const moduleDir = join(module.path, module.name)
  await ensureDir(moduleDir)
  const moduleYamlPath = join(moduleDir, "garden.yml")
  if (await pathExists(moduleYamlPath)) {
    moduleTask.setWarn(`Garden config file already exists for module ${module.name}, skipping`)
  } else {
    await writeFile(moduleYamlPath, safeDump(module.config, { noRefs: true, skipInvalid: true }))
    moduleTask.setSuccess()
  }
}

export function prepareNewModuleConfig(name: string, type: ModuleType, path: string): NewModuleConfigOpts {
  const templateFn = moduleTypeTemplates[type]
  return {
    name,
    type,
    path,
    config: {
      module: {
        ...moduleTemplate(name, type),
        ...templateFn(name),
      },
    },
  }
}
