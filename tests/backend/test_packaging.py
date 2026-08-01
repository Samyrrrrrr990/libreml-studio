from __future__ import annotations

from importlib.resources import files


def test_bundled_dataset_and_license_are_python_package_data() -> None:
    datasets = files("libreml_api").joinpath("resources", "datasets")
    csv_text = datasets.joinpath("community_learning_outcomes.csv").read_text(encoding="utf-8")
    readme = datasets.joinpath("README.md").read_text(encoding="utf-8")
    license_notice = datasets.joinpath("LICENSE.txt").read_text(encoding="utf-8")

    assert csv_text.startswith("participant_id,age,hours_studied")
    assert len(csv_text.splitlines()) == 121
    assert "wholly synthetic" in readme
    assert "outcome_proxy" in readme
    assert "SPDX-License-Identifier: CC0-1.0" in license_notice
