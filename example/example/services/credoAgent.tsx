import type { InitConfig } from '@credo-ts/core'
import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/react-native'
import { AskarModule } from '@credo-ts/askar'
import { ariesAskar } from '@hyperledger/aries-askar-react-native'
import { HttpOutboundTransport, WsOutboundTransport } from '@credo-ts/core';

const config: InitConfig = {
  label: 'docs-agent-react-native',
  walletConfig: {
    id: 'wallet-id',
    key: 'testkey0000000000000000000000000',
  },
}

const agent = new Agent({
  config,
  dependencies: agentDependencies,
  modules: {
    // Register the Askar module on the agent
    askar: new AskarModule({
      ariesAskar,
    }),
  },
})

agent.registerOutboundTransport(new HttpOutboundTransport())
agent.registerOutboundTransport(new WsOutboundTransport())

export default agent;
