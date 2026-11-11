import { defineGoals } from "next-evolve/config";

// What counts as success. Fire events with data-evolve-goal="<event>" on a
// link or form, or evolve.track("<event>") on the server.
export default defineGoals({
  signed_up: { event: "signup", window: "7d" },
});
