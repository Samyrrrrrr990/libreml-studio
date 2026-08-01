# Community Learning Outcomes

`community_learning_outcomes.csv` is a wholly synthetic dataset bundled with LibreML Studio for offline demonstrations, automated tests, and tutorials. It contains no observations about real people.

The columns describe a fictional learning programme:

- `participant_id`: synthetic row identifier.
- `age`: fictional participant age.
- `hours_studied`: fictional weekly study hours.
- `attendance_rate`: fictional attendance percentage.
- `prior_score`: fictional baseline assessment score.
- `program_type`: fictional programme format.
- `completed_program`: binary demonstration target.
- `outcome_proxy`: an intentional copy of the target used to demonstrate LibreML's target-leakage warning and repair flow. It must not be used as a legitimate predictor.

The values were generated deterministically for LibreML Studio and are not intended to support substantive scientific conclusions.

## Licence

The dataset is dedicated to the public domain under CC0 1.0 Universal. See `LICENSE.txt` in this directory.

SPDX-License-Identifier: CC0-1.0
