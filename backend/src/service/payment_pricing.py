import math
from collections.abc import Mapping
from decimal import Decimal
from urllib.parse import urlsplit

DUMMY_URL='https://example.com/miih-payment-placeholder'


def safe_payment_link(link: str | None, active: bool):
    if not link:
        return not active
    if link == DUMMY_URL:
        return not active
    try:
        parsed=urlsplit(link)
    except ValueError:
        return False
    hostname=(parsed.hostname or '').lower()
    return parsed.scheme=='https' and bool(hostname) and (
        hostname in ('rzp.io','rzp.link','razorpay.com') or hostname.endswith('.razorpay.com'))


def normalize_team_size_pricing(rules):
    if rules is None:
        return []
    if not isinstance(rules, list):
        raise ValueError('Team-size pricing must be a list')

    normalized = []
    for rule in rules:
        if not isinstance(rule, Mapping):
            raise ValueError('Each team-size pricing rule must be an object')
        minimum = rule.get('min_members')
        amount = rule.get('fee_amount')
        payment_url = rule.get('razorpay_payment_url')
        if type(minimum) is not int or minimum < 1:
            raise ValueError('Each team-size rule must have a positive integer Members from value')
        if isinstance(amount, bool) or not isinstance(amount, (int, float, Decimal)):
            raise ValueError('Each team-size rule must have a positive finite fee')
        try:
            amount = float(amount)
        except (OverflowError, ValueError) as error:
            raise ValueError('Each team-size rule must have a positive finite fee') from error
        if not math.isfinite(amount) or amount <= 0:
            raise ValueError('Each team-size rule must have a positive finite fee')
        if not isinstance(payment_url, str) or not payment_url.strip():
            raise ValueError('Each team-size rule must have a Razorpay payment URL')
        normalized.append({
            'min_members': minimum,
            'fee_amount': amount,
            'razorpay_payment_url': payment_url.strip(),
        })

    normalized.sort(key=lambda rule: rule['min_members'])
    if any(left['min_members'] == right['min_members'] for left, right in zip(normalized, normalized[1:])):
        raise ValueError('Members from values must be unique')
    return normalized


def payment_rules_from_config(rules, fee_amount=None, payment_url=None):
    normalized = normalize_team_size_pricing(rules)
    if normalized:
        return normalized
    try:
        legacy_fee = float(fee_amount)
    except (TypeError, ValueError, OverflowError):
        return []
    if not math.isfinite(legacy_fee) or legacy_fee <= 0:
        return []
    return normalize_team_size_pricing([{
        'min_members': 1,
        'fee_amount': legacy_fee,
        'razorpay_payment_url': payment_url,
    }])


def payment_rule_for_team_size(rules, team_size: int):
    if type(team_size) is not int or team_size < 1:
        return None
    try:
        normalized = normalize_team_size_pricing(rules)
    except ValueError:
        return None
    return next(
        (rule for rule in reversed(normalized) if rule['min_members'] <= team_size),
        None,
    )
