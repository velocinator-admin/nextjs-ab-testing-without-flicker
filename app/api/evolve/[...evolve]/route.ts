import { createEvolveHandler } from "next-evolve/server";
import evolveConfig from "../../../../evolve.config";
import goals from "../../../../evolve.goals";

// collect (beacon), track, sync (cloud webhook), aggregate (cloud), health
export const { GET, POST } = createEvolveHandler({ config: evolveConfig, goals });
export const maxDuration = 60;
