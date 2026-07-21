Understood. These three constraints clearly define the parameters for selecting and evaluating candidate change sequences. I have internalized the hierarchy of priorities and the specific failure modes you want to avoid. 

Here is how I will operationalize these directives for the deep research:

### 1. Public Boundary: Temporal Availability & De-facto Stability
I will treat the public boundary as a temporal and behavioral contract, not just a static API definition.
*   **Evidence over Documentation:** I will prioritize widely used CLI flags, HTTP endpoints, or config schemas. If a surface is undocumented but has external traction (e.g., referenced in StackOverflow, popular GitHub issues, or third-party integrations), I will explicitly cite this evidence to justify its inclusion.
*   **Sequence-Aware Invocation:** I will map the sequence of changes (4-8 steps) to the availability of the boundary. I will strictly enforce the "introduce-then-use" pattern: a change can introduce a new public surface, and subsequent changes can test behavior through it. I will reject any sequence where the required boundary only materializes at the final step but is needed for held-out tests earlier in the chain.
*   **Skeptic Leader Test:** I will filter out any sequence that relies on mocking internal modules, private functions, or test-only hooks. If an engineering leader would look at the test and say, "This is testing our implementation, not our product," the candidate dies.

### 2. Contamination: Recency as the Moat
I will not over-index on the "user-facing vs. internal" distinction to protect against memorization, relying instead on a strict temporal and structural hierarchy.
*   **Primary Defense (Recency):** I will exclusively target merges that occur post-January 2026. This ensures the model's training data cannot have memorized the specific fix or the sequence of changes.
*   **Secondary Defense (Memorization Check):** I will apply the proposed memorization check to ensure the task hasn't collapsed in difficulty.
*   **Tiebreaker (User-facing vs. Internal):** I will only use "user-facing" as a tiebreaker. If two candidates have equal recency and pass the memorization check, I will select the user-facing sequence with explicit, named dependency mechanisms over an internal refactoring chain. I understand that a purely internal chain often fails the Public Boundary requirement anyway, making this largely a secondary filter.

### 3. Teaching-to-the-Test: Probing the Structural Gap
I will score candidates based on the structural distance between visible acceptance scenarios and held-out tests, using surface richness as the enabler of that distance.
*   **Evaluating the Gap:** For each candidate, I will map the visible scenarios to the held-out tests. If the held-out tests are merely permutations of the visible ones (e.g., same code path, different literal inputs), I will reject the candidate. 
*   **Designing Held-out Probes:** I will ensure held-out tests probe the requirement through distinct routes: state mutations across sequential changes, untested edge cases, and interactions with prior steps in the chain. The goal is to catch "shortcut" implementations that satisfy the visible scenarios but fail to generalize.
*   **Surface Richness as a Prerequisite:** I will actively seek out boundaries with multiple observable dimensions (e.g., a CLI tool with multiple flags, an endpoint returning complex JSON, a stateful config file). I understand that a thin surface (single boolean flag) inherently forces a zero structural gap, making the experiment meaningless. Richness is what creates the space for shortcuts to fail.

**Next Steps for Deep Research:**
With these rules established, I am ready to begin scanning target repositories for post-January 2026 change sequences that meet these criteria. 

Would you like me to begin searching specific open-source ecosystems (e.g., infrastructure tools, CLI utilities, web frameworks), or do you have a specific repository in mind where we should start the sweep?