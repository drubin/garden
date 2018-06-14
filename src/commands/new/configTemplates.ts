/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as inquirer from "inquirer"
import chalk from "chalk"
import { capitalize, camelCase } from "lodash"

import { DeepPartial } from "../../util"
import { ContainerModuleSpec } from "../../plugins/container"
import { GcfModuleSpec } from "../../plugins/google/google-cloud-functions"
import { ProjectConfig } from "../../types/project"
import { BaseModuleSpec, ModuleConfig } from "../../types/module"

/**
 * Note: Ideally there would be some mechanism to discover available module types,
 * and for plugins to expose a minimal config for the given type along with
 * a list of providers per environment, rather than hard coding these values.
 *
 * Alternatively, consider co-locating the templates with the plugins .
 */
export const MODULE_PROVIDER_MAP = {
  container: "local-kubernetes",
  function: "local-google-cloud-functions",
  "npm-package": "npm-package",
}

export type ModuleType = keyof typeof MODULE_PROVIDER_MAP

export interface NewModuleConfigOpts {
  name: string
  type: ModuleType
  path: string
  config?: { module: Partial<ModuleConfig> }
}

export interface ModuleTypeChoice extends inquirer.objects.ChoiceOption {
  value: ModuleType
}
export interface ModuleTypeChoice extends inquirer.objects.ChoiceOption {
  value: ModuleType
}

export const moduleTypeChoices: ModuleTypeChoice[] = [
  {
    name: "container",
    value: "container",
  },
  {
    name: `google-cloud-function (${chalk.red.italic("experimental")})`,
    value: "function",
  },
  {
    name: `npm package (${chalk.red.italic("experimental")})`,
    value: "npm-package",
  },
]

export function containerTemplate(moduleName: string): DeepPartial<ContainerModuleSpec> {
  return {
    services: [
      {
        name: `${moduleName}-service`,
        ports: [{
          name: "http",
          containerPort: 8080,
        }],
        endpoints: [{
          paths: ["/"],
          port: "http",
        }],
      },
    ],
  }
}

export function functionTemplate(moduleName: string): DeepPartial<GcfModuleSpec> {
  return {
    functions: [{
      name: `${moduleName}-function`,
      entrypoint: camelCase(`${moduleName}-function`),
    }],
  }
}

export function npmPackageTemplate(_moduleName: string): any {
  return {}
}

export const projectTemplate = (name: string, moduleTypes: ModuleType[]): Partial<ProjectConfig> => {
  const providers = moduleTypes.map(type => ({ name: MODULE_PROVIDER_MAP[type] }))
  return {
    name,
    environments: [
      {
        name: "local",
        providers,
        variables: {},
      },
    ],
  }
}

export const moduleTemplate = (name: string, type: ModuleType): Partial<BaseModuleSpec> => ({
  name,
  type,
  description: `${titleize(name)} ${noCase(type)}`,
})

const noCase = (str: string) => str.replace(/-|_/g, " ")
const titleize = (str: string) => capitalize(noCase(str))
