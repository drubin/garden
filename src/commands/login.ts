/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  Command,
  CommandResult,
} from "./base"
import { LoggerType } from "../logger/types"
import { PluginContext } from "../plugin-context"
import { LoginStatusMap } from "../types/plugin/outputs"
import dedent = require("dedent")

export class LoginCommand extends Command {
  name = "login"
  help = "Log into configured providers for this project and environment."

  loggerType = LoggerType.basic

  description = dedent`
    Executes the login flow for any provider that requires login (such as the \`kubernetes\` provider).

    Examples:

         garden login
  `

  async action(ctx: PluginContext): Promise<CommandResult<LoginStatusMap>> {
    ctx.log.header({ emoji: "unlock", command: "Login" })
    ctx.log.info("Logging in...")

    const result = await ctx.login({})

    ctx.log.info("\nLogin success!")

    return { result }
  }
}
