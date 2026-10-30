## 2026-10-30T05:19:33Z
You are Challenger 1 (teamwork_challenger) for Milestone 1 of RaktKhoj.
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_challenger_m1_1\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1\handoff.md

OBJECTIVE:
Empirically challenge the Milestone 1 core domain logic through adversarial stress testing:
1. **Adversarial Blood Compatibility Matrix Testing**:
   - Write an adversarial test script / oracle that tests all 64 possible recipient × donor pairs (8 × 8).
   - Verify every pair against medical RBC rules (e.g., O- can ONLY receive O-; AB+ can receive from all 8; Rh- recipients can NEVER receive Rh+ blood).
   - Test invalid/malformed blood group strings (e.g., 'C+', 'O', 'ab+', 'A+ ', null, undefined).
2. **Adversarial Geo-utils Testing**:
   - Test Haversine formula on extreme inputs: antipodal points (distance should be ~20,015 km), identical points (0 km), equator points, poles (lat 90 and -90), and across longitude wrapping (179 to -179).
   - Test bounding box calculations at poles and international dateline.
3. Run your adversarial tests using `bun test` or direct execution script.
4. Output a clear verdict: **APPROVE** or **REQUEST_CHANGES**.

REPORTING:
- Write your empirical challenge report to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_challenger_m1_1\challenge_report.md`
- Write your final handoff to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_challenger_m1_1\handoff.md`
- When complete, send a message to parent reporting your verdict (APPROVE / REQUEST_CHANGES).
