from app.services.long_short_analysis import analyze_long_short, score_long_short_contrarian


def test_divergence_prefers_caution():
    signal, signal_ja, _, stance = analyze_long_short(1.3, 1.25, 0.9, 0.05)
    assert signal == "divergence"
    assert signal_ja == "様子見"
    assert stance == "caution"


def test_rapid_change_is_watch():
    signal, signal_ja, _, stance = analyze_long_short(1.05, 1.05, 1.05, 0.2)
    assert signal == "rapid_change"
    assert signal_ja == "様子見"
    assert stance == "caution"


def test_overheated_long_is_bearish():
    signal, signal_ja, _, stance = analyze_long_short(1.35, 1.3, 1.2, 0.02)
    assert signal == "overheated_long"
    assert signal_ja == "下落の症候"
    assert stance == "bearish"


def test_score_caps_at_two():
    bull, bear = score_long_short_contrarian(1.4, 1.35, 0.8, 0.2, 0.001)
    assert bull <= 2
    assert bear <= 2
    assert bear >= 1
