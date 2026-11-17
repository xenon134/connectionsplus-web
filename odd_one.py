import glob
import json
import os
import random
from datetime import date, timedelta

from puzzles import LAUNCH_DATE, PUZZLE_DIR, load_puzzle


def _random_date():
    today = date.today()
    span = (today - LAUNCH_DATE).days
    if span <= 0:
        return LAUNCH_DATE
    return LAUNCH_DATE + timedelta(days=random.randint(0, span))


def _category_words(category):
    if not isinstance(category, dict):
        return None
    cards = category.get("cards")
    if not isinstance(cards, list) or len(cards) != 4:
        return None

    words = []
    for card in cards:
        if not isinstance(card, dict):
            return None
        word = card.get("content")
        if not isinstance(word, str) or not word.strip():
            return None
        words.append(word.strip())

    if len({word.lower() for word in words}) != 4:
        return None
    return words


def _round_from_data(data, date_str):
    if not isinstance(data, dict):
        return None
    categories = data.get("categories")
    if not isinstance(categories, list):
        return None

    prepared = []
    for index, category in enumerate(categories[:4]):
        words = _category_words(category)
        if words is None:
            continue
        title = category.get("title")
        if not isinstance(title, str) or not title.strip():
            title = "Category"
        prepared.append((index, title.strip(), words))

    if len(prepared) < 2:
        return None

    pick = random.randrange(len(prepared))
    color_index, title, words = prepared[pick]
    taken = {word.lower() for word in words}
    other_words = [
        word
        for index, (_, _, category_words) in enumerate(prepared)
        if index != pick
        for word in category_words
        if word.lower() not in taken
    ]
    if not other_words:
        return None

    odd_word = random.choice(other_words)
    five_words = [*words, odd_word]
    random.shuffle(five_words)

    return {
        "date": date_str,
        "category": title,
        "colorIndex": color_index,
        "words": five_words,
        "answer": odd_word,
    }


def _cached_round(exclude=None):
    paths = glob.glob(os.path.join(PUZZLE_DIR, "*.json"))
    random.shuffle(paths)

    for path in paths:
        date_str = os.path.splitext(os.path.basename(path))[0]
        if exclude and date_str == exclude:
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        result = _round_from_data(data, date_str)
        if result:
            return result

    return None


def build_round(exclude=None, attempts=5):
    """Pick a random archive day and build one Odd One round.

    Tries uncached archive dates first. After two failed fetches it falls back
    to whatever is already in the local puzzle cache, so a network problem
    still lets the game continue.
    """
    failures = 0
    for _ in range(attempts):
        day = _random_date()
        date_str = day.isoformat()
        if exclude and date_str == exclude:
            continue

        data = load_puzzle(date_str)
        if data is None:
            failures += 1
            if failures >= 2:
                break
            continue

        result = _round_from_data(data, date_str)
        if result:
            return result

    return _cached_round(exclude)
