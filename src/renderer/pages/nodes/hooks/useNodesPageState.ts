import { useGateway } from '../../../contexts/GatewayContext'
import { useNodesList } from './useNodesList'
import { useDevices } from './useDevices'
import { useNodeBindings } from './useNodeBindings'
import { useExecApprovals } from './useExecApprovals'

export function useNodesPageState() {
   const { rpc, connected } = useGateway()
   const nodesList = useNodesList(rpc, connected)
   const devices = useDevices(rpc, connected)
   const bindings = useNodeBindings(rpc, connected, nodesList.nodes)
   const execApprovals = useExecApprovals(
      rpc,
      connected,
      nodesList.nodes,
      bindings.configForm,
   )

   return {
      connected,
      nodesList,
      devices,
      bindings,
      execApprovals,
   }
}
