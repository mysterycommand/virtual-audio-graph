import { entries, equals, values } from './utils'
import connectAudioNodes from './connectAudioNodes'
import { VirtualAudioNode, VirtualAudioNodeGraph } from './types'

export default class VirtualAudioGraph {
  private virtualNodes: VirtualAudioNodeGraph = {}

  constructor (
    private readonly audioContext: AudioContext,
    private readonly output: AudioDestinationNode,
  ) {}

  get currentTime (): number {
    return this.audioContext.currentTime
  }

  disconnectParents (vNode: VirtualAudioNode): void {
    for (const node of values(this.virtualNodes)) {
      node.disconnect(vNode)
    }
  }

  getAudioNodeById (id: string): AudioNode | void {
    const vNode = this.virtualNodes[id]
    return vNode && vNode.audioNode
  }

  update (newGraph: VirtualAudioNodeGraph): this {
    if (newGraph.hasOwnProperty('output')) throw new Error('"output" is not a valid id')

    for (const [id, virtualAudioNode] of entries(this.virtualNodes)) {
      if (newGraph.hasOwnProperty(id)) continue
      virtualAudioNode.disconnectAndDestroy()
      this.disconnectParents(virtualAudioNode)
      delete this.virtualNodes[id]
    }

    for (const key of Object.keys(newGraph)) {
      const newVirtualAudioNode = newGraph[key]
      const virtualAudioNode = this.virtualNodes[key]

      if (virtualAudioNode == null) {
        this.virtualNodes[key] = newVirtualAudioNode.initialize(this.audioContext)
        continue
      }

      if (
        (newVirtualAudioNode.params && newVirtualAudioNode.params.startTime) !==
          (virtualAudioNode.params && virtualAudioNode.params.startTime) ||
        (newVirtualAudioNode.params && newVirtualAudioNode.params.stopTime) !==
          (virtualAudioNode.params && virtualAudioNode.params.stopTime) ||
          newVirtualAudioNode.node !== virtualAudioNode.node
      ) {
        virtualAudioNode.disconnectAndDestroy()
        this.disconnectParents(virtualAudioNode)
        this.virtualNodes[key] = newVirtualAudioNode.initialize(this.audioContext)
        continue
      }

      if (!equals(newVirtualAudioNode.output, virtualAudioNode.output)) {
        virtualAudioNode.disconnect()
        this.disconnectParents(virtualAudioNode)
        virtualAudioNode.output = newVirtualAudioNode.output
      }

      virtualAudioNode.update(newVirtualAudioNode.params)
    }

    connectAudioNodes(
      this.virtualNodes,
      (vNode: VirtualAudioNode) => vNode.connect(this.output),
    )

    return this
  }
}
