// Import and export the VibeStack app directly
import worker, { SyncDO, ReplicationDO, OrganizationActor } from './src/server/index'
import { EmbeddingGeneratorDO } from './src/server/actors/EmbeddingGeneratorDO'

export default worker
export { SyncDO, ReplicationDO, OrganizationActor, EmbeddingGeneratorDO }
