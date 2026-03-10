"""
Seed script: populate the database with ~30 days of realistic journal data.

Usage:
    cd backend && python -m scripts.seed_demo

Creates a compelling demo dataset for user_id=1 ("Tarek") that exercises
every screen in the app: journal, dashboard, actions, habit detail,
completable detail, and domain scores.

The story: someone who started journalling 30 days ago in a rough spot.
Over the month they discovered that exercise + office + social = better days,
built routines, and watched their floor rise from 2.5 to 5.0.
Two avoidance patterns persist: the James conversation and finances.
"""

from __future__ import annotations

import sys
import os

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date, datetime, time, timedelta
from typing import Optional

from app.core.database import SessionLocal, engine, Base
from app.domain.models.user import User
from app.domain.models.user_preference import UserPreference
from app.domain.models.daily_checkin import DailyCheckIn
from app.domain.models.journal_session import JournalSession
from app.domain.models.journal_message import JournalMessage
from app.domain.models.life_domain_score import LifeDomainScore
from app.domain.models.domain_checkin import DomainCheckin
from app.domain.models.action import Action
from app.domain.models.action_milestone import ActionMilestone
from app.domain.models.habit_log import HabitLog
from app.domain.models.personal_pattern import PersonalPattern
from app.domain.models.milestone import Milestone
from app.domain.models.audit_event import AuditEvent
from app.domain.models.suggestion_dismissal import SuggestionDismissal


# ──────────────────────────────────────────────────────────────────
# Date helpers
# ──────────────────────────────────────────────────────────────────

TODAY = date.today()
DAY_1 = TODAY - timedelta(days=29)  # 30 days ago (day 1 = index 0)


def day(n: int) -> date:
    """Return the date for day N of the story (1-indexed)."""
    return DAY_1 + timedelta(days=n - 1)


def dt(d: date, hour: int = 9, minute: int = 0) -> datetime:
    """Make a datetime from a date + time."""
    return datetime.combine(d, time(hour, minute))


# ──────────────────────────────────────────────────────────────────
# Score arc (30 days)
# ──────────────────────────────────────────────────────────────────

SCORES = [
    # Week 1: volatile (days 1-7)
    4.0, 2.5, 5.0, 3.5, 6.0, 4.0, 5.5,
    # Week 2: building (days 8-14)
    6.0, 3.0, 6.0, 6.5, 4.0, 5.5, 7.0,
    # Week 3: stabilising (days 15-21)
    6.0, 5.5, 6.5, 6.0, 7.0, 5.0, 6.5,
    # Week 4: floor rising (days 22-28)
    6.0, 5.5, 7.0, 6.5, 6.0, 5.0, 6.5,
    # Recent (days 29-30)
    7.0, 6.5,
]

# ──────────────────────────────────────────────────────────────────
# Daily check-in data (notes, behaviors, context, ai_inferred)
# ──────────────────────────────────────────────────────────────────

DAILY_DATA = [
    # --- Day 1 (score 4.0) ---
    {
        "notes": "First time writing anything like this. Don't know what to say really. Career feels like it's going nowhere, just going through the motions. Lea and I barely talked this weekend. Everything feels flat.",
        "behaviors": {"exercise": False, "socialised": False, "office": False},
        "context": {"exercise": False, "location": "home", "sleep": "poor", "substances": None},
        "inferred": {"motivation": 3.0, "anxiety_level": 5.0, "self_worth": 3.5, "sentiment_score": -0.4, "inferred_overall": 3.8},
    },
    # --- Day 2 (score 2.5) ---
    {
        "notes": "Terrible day. Didn't leave the flat. Scrolled my phone for hours. Lea asked if I was okay and I snapped at her. Feel guilty about it. Can't seem to get out of this hole.",
        "behaviors": {"exercise": False, "socialised": False, "office": False, "conflict": True},
        "context": {"exercise": False, "location": "home", "sleep": "poor", "conflict": True, "conflict_with": "partner", "substances": None},
        "inferred": {"motivation": 2.0, "anxiety_level": 7.0, "self_worth": 2.5, "sentiment_score": -0.7, "inferred_overall": 2.3},
    },
    # --- Day 3 (score 5.0) ---
    {
        "notes": "Went for a walk in the park, first time outside in two days. Felt a bit better once I was moving. Called Mum which was nice. Still not great but definitely better than yesterday.",
        "behaviors": {"exercise": True, "socialised": True, "office": False},
        "context": {"exercise": True, "exercise_type": "walk", "social_contact": "family", "location": "home", "sleep": "okay"},
        "inferred": {"motivation": 4.5, "anxiety_level": 4.0, "self_worth": 4.5, "sentiment_score": 0.0, "inferred_overall": 4.8},
    },
    # --- Day 4 (score 3.5) ---
    {
        "notes": "Worked from home. Couldn't focus on anything for more than 20 minutes. Kept looking at my phone. Lea came home late. Ate takeaway alone watching TV. Another wasted day.",
        "behaviors": {"exercise": False, "socialised": False, "office": False},
        "context": {"exercise": False, "location": "home", "sleep": "okay", "work_type": "wfh_unfocused"},
        "inferred": {"motivation": 3.0, "anxiety_level": 4.5, "self_worth": 3.0, "sentiment_score": -0.4, "inferred_overall": 3.3},
    },
    # --- Day 5 (score 6.0) — First good day ---
    {
        "notes": "Actually went to the gym this morning for the first time in months. Then went to the office and grabbed lunch with Tom and Sarah. Felt like a different person. The combination of exercise, being around people, and having some structure — it just worked.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.5, "anxiety_level": 2.5, "self_worth": 5.5, "sentiment_score": 0.5, "inferred_overall": 6.2},
    },
    # --- Day 6 (score 4.0) — Father interaction ---
    {
        "notes": "My father called this morning, the usual lecture about how I should be further along in my career. It completely derailed my day. Didn't go to the gym. Sat at home stewing on it. Lea tried to help but I just wanted to be alone.",
        "behaviors": {"exercise": False, "socialised": False, "office": False},
        "context": {"exercise": False, "location": "home", "sleep": "okay", "conflict": True, "conflict_with": "father", "social_contact": "family_negative"},
        "inferred": {"motivation": 3.0, "anxiety_level": 6.0, "self_worth": 3.0, "sentiment_score": -0.5, "inferred_overall": 3.8},
    },
    # --- Day 7 (score 5.5) — First James mention ---
    {
        "notes": "Better than yesterday. Went for a morning run which helped clear my head. Work was okay. Realised I need to talk to James about the project scope — it's been bugging me but I keep putting it off. Had dinner with Lea, things felt warmer.",
        "behaviors": {"exercise": True, "socialised": True, "office": False},
        "context": {"exercise": True, "exercise_type": "run", "social_contact": "partner", "location": "home", "sleep": "good"},
        "inferred": {"motivation": 5.0, "anxiety_level": 3.5, "self_worth": 5.0, "sentiment_score": 0.2, "inferred_overall": 5.3},
    },
    # --- Day 8 (score 6.0) ---
    {
        "notes": "Good day. Went to the office, felt productive for the first time in a while. Had a proper lunch with the team instead of eating at my desk. Gym after work — legs are sore but in a good way. Starting to think I need to do this more consistently.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "colleagues", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.0, "anxiety_level": 3.0, "self_worth": 5.5, "sentiment_score": 0.4, "inferred_overall": 6.0},
    },
    # --- Day 9 (score 3.0) — The crash ---
    {
        "notes": "Stayed home. Didn't go to gym, didn't see anyone. Just phone and couch all day. I know exactly what I'm doing — yesterday was great and today I'm back to this. It's frustrating because I can see the pattern but I still can't break it.",
        "behaviors": {"exercise": False, "socialised": False, "office": False, "isolated": True},
        "context": {"exercise": False, "location": "home", "sleep": "poor", "isolated": True, "substances": None},
        "inferred": {"motivation": 2.5, "anxiety_level": 5.5, "self_worth": 3.0, "sentiment_score": -0.5, "inferred_overall": 3.0},
    },
    # --- Day 10 (score 6.0) ---
    {
        "notes": "Forced myself to the gym even though I didn't want to. Called the insurance company about the therapist referral, finally. Then went to the office and had a decent afternoon. The rebound is always fast when I just do the three things.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "colleagues", "location": "office", "sleep": "okay"},
        "inferred": {"motivation": 5.5, "anxiety_level": 3.5, "self_worth": 5.5, "sentiment_score": 0.3, "inferred_overall": 5.8},
    },
    # --- Day 11 (score 6.5) ---
    {
        "notes": "Gym in the morning, office all day, grabbed drinks with Tom after work. Lea and I had a nice evening cooking together. Feel like things are slowly clicking. Started sertraline three days ago — too early to tell if it's doing anything.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good", "medication": "sertraline_start"},
        "inferred": {"motivation": 6.5, "anxiety_level": 2.5, "self_worth": 6.0, "sentiment_score": 0.5, "inferred_overall": 6.5},
    },
    # --- Day 12 (score 4.0) — Finance mention 1 ---
    {
        "notes": "Worked from home. Got an unexpected credit card bill — way higher than I thought. I genuinely don't know where the money is going. Lea mentioned the spending too which made me defensive. Didn't exercise. Just a dull, anxious day.",
        "behaviors": {"exercise": False, "socialised": False, "office": False},
        "context": {"exercise": False, "location": "home", "sleep": "okay", "financial_stress": True, "conflict": True, "conflict_with": "partner"},
        "inferred": {"motivation": 3.5, "anxiety_level": 6.0, "self_worth": 4.0, "sentiment_score": -0.3, "inferred_overall": 4.0},
    },
    # --- Day 13 (score 5.5) ---
    {
        "notes": "Went in to work, gym at lunch. Better than yesterday but still rattled about the money thing. Had a good catch-up with Sarah about her new project. Need to keep showing up even when I don't feel like it.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "okay"},
        "inferred": {"motivation": 5.0, "anxiety_level": 4.0, "self_worth": 5.0, "sentiment_score": 0.2, "inferred_overall": 5.5},
    },
    # --- Day 14 (score 7.0) — Best day yet, James mention 2 ---
    {
        "notes": "Everything clicked today. Gym at 7am, felt amazing. Office was productive — finished the client deck I'd been procrastinating on. Had lunch with the whole team. After work, drinks with Tom and Alex. I should talk to James about the scope issue on the Henderson project though. Keep meaning to bring it up but there's never a good time.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good", "achievement": True, "achievement_note": "finished_client_deck"},
        "inferred": {"motivation": 7.5, "anxiety_level": 2.0, "self_worth": 7.0, "sentiment_score": 0.7, "inferred_overall": 7.2},
    },
    # --- Day 15 (score 6.0) ---
    {
        "notes": "Saturday. Went for a long run in the park, about 5k. Lea and I went to the farmers market. Quiet afternoon reading. Feel steady, not amazing but solid. This is what normal feels like I think.",
        "behaviors": {"exercise": True, "socialised": True, "office": False},
        "context": {"exercise": True, "exercise_type": "run", "social_contact": "partner", "location": "home", "sleep": "good"},
        "inferred": {"motivation": 5.5, "anxiety_level": 3.0, "self_worth": 5.5, "sentiment_score": 0.3, "inferred_overall": 5.8},
    },
    # --- Day 16 (score 5.5) ---
    {
        "notes": "Sunday. Lazy morning which was fine. Went to the gym in the afternoon. Met Tom for coffee. Lea went to see her sister so I had the evening to myself — didn't spiral, just watched a film and went to bed early. Progress.",
        "behaviors": {"exercise": True, "socialised": True, "office": False},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "home", "sleep": "good"},
        "inferred": {"motivation": 5.0, "anxiety_level": 3.0, "self_worth": 5.5, "sentiment_score": 0.2, "inferred_overall": 5.5},
    },
    # --- Day 17 (score 6.5) ---
    {
        "notes": "Gym then office. Good focused morning. Had a solid meeting with the design team. Lunch with colleagues. Getting into a rhythm now — the gym-office-people trifecta really does work for me. Lea and I planned a trip for next month.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "colleagues", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.5, "anxiety_level": 2.5, "self_worth": 6.0, "sentiment_score": 0.5, "inferred_overall": 6.3},
    },
    # --- Day 18 (score 6.0) ---
    {
        "notes": "Office day, no gym — was too tired. Submitted the therapist referral documents finally so that's done. Work was fine, nothing exciting. Had a quick lunch with Sarah. Feeling steady but low energy today.",
        "behaviors": {"exercise": False, "socialised": True, "office": True},
        "context": {"exercise": False, "social_contact": "colleagues", "location": "office", "sleep": "okay"},
        "inferred": {"motivation": 5.5, "anxiety_level": 3.0, "self_worth": 5.5, "sentiment_score": 0.2, "inferred_overall": 5.8},
    },
    # --- Day 19 (score 7.0) ---
    {
        "notes": "Great day. Morning gym session, PR on bench press. Office was productive. Tom, Sarah and I had a long lunch where we actually talked about real stuff — his divorce, my mental health. Felt connected. Came home and Lea and I went for a walk.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good", "achievement": True, "achievement_note": "gym_pr"},
        "inferred": {"motivation": 7.0, "anxiety_level": 2.0, "self_worth": 7.0, "sentiment_score": 0.7, "inferred_overall": 7.0},
    },
    # --- Day 20 (score 5.0) — Father + Finance mention 2 ---
    {
        "notes": "Dad visited. Two hours of him telling me about my cousin's promotion. I know he means well but it wrecks me. Spent the afternoon on the couch. Looked at my bank app and it's worse than I thought — I really need to look at last month's spending properly. Just feel deflated.",
        "behaviors": {"exercise": False, "socialised": False, "office": False},
        "context": {"exercise": False, "location": "home", "sleep": "okay", "conflict": True, "conflict_with": "father", "financial_stress": True},
        "inferred": {"motivation": 3.5, "anxiety_level": 6.0, "self_worth": 4.0, "sentiment_score": -0.4, "inferred_overall": 4.8},
    },
    # --- Day 21 (score 6.5) — James mention 3 ---
    {
        "notes": "Bounced back. Gym first thing, office for the afternoon. Good focus. Still haven't talked to James — keep finding reasons to delay. I know it needs to happen. The longer I leave it the bigger it gets in my head. Had a nice evening with Lea, watched a documentary together.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "partner", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.0, "anxiety_level": 3.5, "self_worth": 6.0, "sentiment_score": 0.3, "inferred_overall": 6.3},
    },
    # --- Day 22 (score 6.0) ---
    {
        "notes": "Solid day. Morning run, worked from home but stayed focused with the Pomodoro timer. Had a video call with Alex. Lea and I cooked dinner together. Not a peak day but a good one.",
        "behaviors": {"exercise": True, "socialised": True, "office": False},
        "context": {"exercise": True, "exercise_type": "run", "social_contact": "friends", "location": "home", "sleep": "good", "work_type": "wfh_focused"},
        "inferred": {"motivation": 5.5, "anxiety_level": 3.0, "self_worth": 5.5, "sentiment_score": 0.3, "inferred_overall": 5.8},
    },
    # --- Day 23 (score 5.5) ---
    {
        "notes": "Gym then office. Fine day. Meeting in the afternoon dragged on and drained me. Came home tired but not low. Lea was out so I had dinner alone — managed not to fall into the old spiral. Read a book instead of doomscrolling.",
        "behaviors": {"exercise": True, "socialised": False, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": None, "location": "office", "sleep": "okay"},
        "inferred": {"motivation": 5.0, "anxiety_level": 3.5, "self_worth": 5.5, "sentiment_score": 0.1, "inferred_overall": 5.5},
    },
    # --- Day 24 (score 7.0) ---
    {
        "notes": "One of the better days. Gym, office, lunch with Sarah and a new guy from the product team. Really productive afternoon — cleared my entire backlog. Lea surprised me with dinner reservations. Feels like everything is working when I show up.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good", "achievement": True, "achievement_note": "cleared_backlog"},
        "inferred": {"motivation": 7.0, "anxiety_level": 2.0, "self_worth": 7.0, "sentiment_score": 0.7, "inferred_overall": 7.0},
    },
    # --- Day 25 (score 6.5) ---
    {
        "notes": "Morning gym, office day. Steady. Had a slightly tricky conversation with my manager about timelines but handled it okay. Tom and I grabbed a quick coffee. Feeling like this is my new baseline — not euphoric but consistent.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.0, "anxiety_level": 3.0, "self_worth": 6.0, "sentiment_score": 0.4, "inferred_overall": 6.3},
    },
    # --- Day 26 (score 6.0) — Finance mention 3 ---
    {
        "notes": "Good gym session but then spent the afternoon worrying about money. Spending is out of control — I genuinely don't know where it all goes. Subscriptions, takeaways, random Amazon stuff. I need to actually sit down and look at last month's numbers. Lea noticed I was distracted at dinner.",
        "behaviors": {"exercise": True, "socialised": True, "office": False},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "partner", "location": "home", "sleep": "okay", "financial_stress": True},
        "inferred": {"motivation": 5.0, "anxiety_level": 5.0, "self_worth": 5.5, "sentiment_score": -0.1, "inferred_overall": 5.8},
    },
    # --- Day 27 (score 5.0) ---
    {
        "notes": "No gym, worked from home. Rainy day. Didn't see anyone in person. Had a few video calls which were fine but not the same. Made dinner for myself and Lea. Not bad but the absence of the usual routine shows immediately in how I feel.",
        "behaviors": {"exercise": False, "socialised": False, "office": False},
        "context": {"exercise": False, "location": "home", "sleep": "okay", "social_contact": "partner"},
        "inferred": {"motivation": 4.5, "anxiety_level": 4.0, "self_worth": 5.0, "sentiment_score": 0.0, "inferred_overall": 5.0},
    },
    # --- Day 28 (score 6.5) — James mention 4 ---
    {
        "notes": "Back to routine. Gym, office, lunch with the team. Keep finding excuses not to talk to James — today it was 'he looked busy'. Four weeks of telling myself I'll do it tomorrow. At least everything else went well. Productive afternoon, nice evening with Lea.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "colleagues", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.0, "anxiety_level": 3.5, "self_worth": 6.0, "sentiment_score": 0.3, "inferred_overall": 6.3},
    },
    # --- Day 29 (score 7.0) ---
    {
        "notes": "Great day. Morning gym, felt strong. Office was productive and I had a long walk at lunch with Tom. He's going through it too which makes me feel less alone. Came home and Lea and I went out for dinner. Best streak I've had in a long time.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 7.0, "anxiety_level": 2.0, "self_worth": 7.0, "sentiment_score": 0.7, "inferred_overall": 7.0},
    },
    # --- Day 30 (score 6.5) — Today ---
    {
        "notes": "Decent day. Gym helped as usual. Work was fine, nothing special. Still thinking about the James thing — it's becoming the thing I think about before bed. Lea and I had a quiet evening. Overall good but those two loose ends (James + finances) are nagging.",
        "behaviors": {"exercise": True, "socialised": True, "office": True},
        "context": {"exercise": True, "exercise_type": "gym", "social_contact": "partner", "location": "office", "sleep": "good"},
        "inferred": {"motivation": 6.0, "anxiety_level": 3.0, "self_worth": 6.0, "sentiment_score": 0.3, "inferred_overall": 6.3},
    },
]


# ──────────────────────────────────────────────────────────────────
# Journal sessions with full conversation messages
# ──────────────────────────────────────────────────────────────────

def build_sessions() -> list[dict]:
    """Return journal session definitions with messages."""
    return [
        # ── Day 1: First entry ──
        {
            "day": 1, "score": 4.0, "hour": 21, "minute": 30,
            "messages": [
                ("user", "Not sure what to write here. First time doing anything like this. I just feel stuck. Career is going nowhere — I'm doing the same thing I was doing two years ago. Lea and I are on autopilot. We barely talk about anything real anymore. Everything just feels flat and I don't know how to fix it."),
                ("assistant",
                 "That's a lot sitting under the surface. Career stagnation and relationship autopilot at the same time — that's a heavy combination. Let's start with what feels most stuck right now. Is it the work situation or the dynamic with Lea that bothers you more day-to-day?",
                 {
                     "inferred_dimensions": {"motivation": 3.0, "anxiety_level": 5.0, "self_worth": 3.5},
                     "context_tags": {"exercise": False, "location": "home", "sleep": "poor"},
                     "factors": {"exercise": False, "socialised": False, "office": False},
                     "extracted_actions": [],
                 }),
                ("user", "Probably work. At least with Lea I know what the problem is — we're just not making time for each other. With work I genuinely don't know what to do. I feel like I should be further along."),
                ("assistant",
                 "\"Should be further along\" is your father's framing or your own? That matters because the fix is different. If it's genuinely your ambition that's unmet, the question is what's blocking the next step. If it's comparison pressure, the fix is boundaries not career changes. What does 'further along' actually look like to you?",
                 None),
            ],
        },
        # ── Day 5: First good day ──
        {
            "day": 5, "score": 6.0, "hour": 20, "minute": 0,
            "messages": [
                ("user", "Today was actually good. Went to the gym this morning, went to the office, had lunch with Tom and Sarah. Don't know why but I just felt different. More like myself."),
                ("assistant",
                 "Three things happened today that didn't happen on your bad days: exercise, people, and structure. That might not be a coincidence. Your worst days so far have been home, alone, no movement. Today you had all three and scored 6.0 — your highest so far. One data point isn't a pattern yet, but it's worth watching.",
                 {
                     "inferred_dimensions": {"motivation": 6.5, "anxiety_level": 2.5, "self_worth": 5.5},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good"},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [
                         {"text": "Prioritise daily exercise", "action_type": "habit", "domain": "health", "confidence": 0.75},
                     ],
                 }),
                ("user", "Yeah, looking back at the week the days I felt worst were definitely the ones where I just sat at home. Maybe I need to make gym + office the default instead of something I do when I feel like it."),
                ("assistant",
                 "That's the right reframe. The trap is waiting to feel motivated before doing the thing that creates the motivation. Gym and office aren't rewards for feeling good — they're the inputs that produce it. Worth treating them as non-negotiable defaults rather than options.",
                 None),
            ],
        },
        # ── Day 9: The crash ──
        {
            "day": 9, "score": 3.0, "hour": 22, "minute": 15,
            "messages": [
                ("user", "Back to shit. Stayed home all day. Didn't go to the gym, didn't see anyone. Just phone and couch. I know the pattern now — I can literally see it — but I still did it anyway."),
                ("assistant",
                 "Every crash so far follows the same setup: no exercise, no people, no structure. Yesterday you had all three and scored 6.0. Today you had none and hit 3.0. The data is getting hard to argue with. Knowing the pattern isn't the same as breaking it, but naming exactly what went wrong is step one. What happened this morning that led to staying home?",
                 {
                     "inferred_dimensions": {"motivation": 2.5, "anxiety_level": 5.5, "self_worth": 3.0},
                     "context_tags": {"exercise": False, "location": "home", "sleep": "poor", "isolated": True},
                     "factors": {"exercise": False, "socialised": False, "office": False, "isolated": True},
                     "extracted_actions": [],
                 }),
                ("user", "I just woke up and didn't want to move. It's like inertia — once I'm in the hole it's hard to climb out."),
                ("assistant",
                 "That's the critical window — the first 30 minutes after waking. Once you're on the couch with your phone, the day is probably gone. The intervention point isn't motivation, it's a physical trigger before your brain has time to negotiate. Gym clothes by the bed, alarm across the room, whatever breaks the inertia before it sets in.",
                 None),
            ],
        },
        # ── Day 14: Best day yet + James mention ──
        {
            "day": 14, "score": 7.0, "hour": 21, "minute": 0,
            "messages": [
                ("user", "Best day in a long time. Gym at 7, office all day, finished that client deck I'd been dreading. Lunch with the team, drinks with Tom and Alex after. Just felt sharp and present. Also realised I really need to talk to James about the Henderson project scope. The deliverables don't match what we agreed and it's going to blow up if I don't say something."),
                ("assistant",
                 "7.0 — your highest score. And it follows the exact template: exercise, structure, social contact, plus meaningful output. The client deck completion probably added a sense of agency that boosted everything else. On the James conversation — what's the specific concern? Is it that the scope has crept, or that expectations were misaligned from the start?",
                 {
                     "inferred_dimensions": {"motivation": 7.5, "anxiety_level": 2.0, "self_worth": 7.0},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good", "achievement": True},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [
                         {"text": "Have the scope conversation with James", "action_type": "completable", "domain": "career", "confidence": 0.85},
                     ],
                 }),
                ("user", "Scope crept. We agreed on three deliverables and now it's basically five but nobody adjusted the timeline or resources. I know it needs to happen but James doesn't react well to pushback."),
                ("assistant",
                 "The longer you leave it, the more the scope solidifies as the expectation. Right now you can frame it as 'catching a misalignment early.' In two more weeks, it becomes 'failing to deliver what was promised.' The conversation gets harder, not easier. What would you need to feel prepared to have it?",
                 None),
            ],
        },
        # ── Day 18: Therapist referral done ──
        {
            "day": 18, "score": 6.0, "hour": 19, "minute": 30,
            "messages": [
                ("user", "Not a huge day but got the therapist referral submitted. That's been hanging over me for weeks. GP appointment went well, paperwork is done. At least that's one thing ticked off."),
                ("assistant",
                 "That's a meaningful completion. The referral had been on your list since day 8 and you followed through across three steps — calling insurance, getting the GP appointment, submitting the paperwork. That's real follow-through on something that matters. How are you feeling about the sertraline so far?",
                 {
                     "inferred_dimensions": {"motivation": 5.5, "anxiety_level": 3.0, "self_worth": 5.5},
                     "context_tags": {"exercise": False, "social_contact": "colleagues", "location": "office", "sleep": "okay"},
                     "factors": {"exercise": False, "socialised": True, "office": True},
                     "extracted_actions": [],
                 }),
                ("user", "Hard to tell. It's only been a week. Maybe slightly less anxious? Could be placebo. I'll give it more time."),
                ("assistant",
                 "Fair. SSRIs typically take 3-4 weeks to show meaningful effect, so a week is too early to draw conclusions. Keep noting how you feel — the data will show it before you notice it subjectively.",
                 None),
            ],
        },
        # ── Day 21: James avoidance (3rd mention) ──
        {
            "day": 21, "score": 6.5, "hour": 20, "minute": 45,
            "messages": [
                ("user", "Good day overall. Gym, office, decent focus. But still haven't talked to James. Keep finding reasons — today it was 'he was in back-to-back meetings.' I know I'm avoiding it."),
                ("assistant",
                 "Three mentions, three deferrals. Day 7: 'I need to talk to James.' Day 14: 'I should talk to James about scope.' Today: 'Still haven't.' You're naming the avoidance — which is progress — but naming it isn't acting on it. What specifically happens if the conversation goes badly?",
                 {
                     "inferred_dimensions": {"motivation": 6.0, "anxiety_level": 3.5, "self_worth": 6.0},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "partner", "location": "office", "sleep": "good"},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [],
                 }),
                ("user", "Worst case he gets defensive, says the scope is what it is, and I'm stuck doing more work than we agreed. Or he thinks I'm being difficult."),
                ("assistant",
                 "So the worst case is: you do the same extra work you're already doing, but now James knows you flagged it. That's actually better than the current situation where you absorb the overload silently. The 'being difficult' fear is worth examining — is there a pattern of avoiding conflict to be seen as agreeable?",
                 None),
            ],
        },
        # ── Day 24: Peak day ──
        {
            "day": 24, "score": 7.0, "hour": 20, "minute": 30,
            "messages": [
                ("user", "Really good day. Gym, office, cleared my entire backlog. Lunch with Sarah and a new guy from product — interesting conversation. Lea surprised me with dinner reservations. Everything just works when I show up and do the things."),
                ("assistant",
                 "You've scored 7.0 three times now — days 14, 19, and today. Each one had the same ingredients: gym, office, social contact, and meaningful completion at work. Your floor has risen from 2.5 in week one to 5.0 now. The routine is doing its job. The question is no longer whether the formula works — it's whether you can protect it on the days your brain tries to negotiate you out of it.",
                 {
                     "inferred_dimensions": {"motivation": 7.0, "anxiety_level": 2.0, "self_worth": 7.0},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good", "achievement": True},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [],
                 }),
            ],
        },
        # ── Day 26: Finance concern ──
        {
            "day": 26, "score": 6.0, "hour": 21, "minute": 15,
            "messages": [
                ("user", "Good gym session this morning. But spent the afternoon spiralling about money. The spending is out of control — I genuinely don't know where it goes. Subscriptions, takeaways, random Amazon orders. It's adding up and I keep ignoring it."),
                ("assistant",
                 "\"I don't know where the money goes\" is the kind of vague framing that lets the problem stay invisible. The fix isn't budgeting philosophy — it's looking at the actual numbers. Would you commit to actually looking at last month's spending this week? Not fixing it, just seeing it.",
                 {
                     "inferred_dimensions": {"motivation": 5.0, "anxiety_level": 5.0, "self_worth": 5.5},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "partner", "location": "home", "sleep": "okay", "financial_stress": True},
                     "factors": {"exercise": True, "socialised": True, "office": False},
                     "extracted_actions": [
                         {"text": "Review last month's spending", "action_type": "completable", "domain": "finance", "confidence": 0.80},
                     ],
                 }),
                ("user", "Yeah I can do that. Just opening the bank app and looking at the categories. Not committing to a budget yet."),
                ("assistant",
                 "Good. The threshold is low on purpose. Just look. Most people who avoid their finances are afraid of what they'll see, and the anxiety of not knowing is usually worse than the reality. Once you see it, you can decide what to do about it.",
                 None),
            ],
        },
        # ── Day 28: James avoidance (4th mention) ──
        {
            "day": 28, "score": 6.5, "hour": 21, "minute": 0,
            "messages": [
                ("user", "Good day overall. Gym, office, lunch with the team. But I found another excuse not to talk to James — he 'looked busy.' I'm running out of excuses honestly. Four weeks of this now."),
                ("assistant",
                 "Four mentions now. Day 7: 'I need to talk to James.' Day 14: 'I should talk to James.' Day 21: 'Still haven't.' Today: 'Keep finding excuses.' At this point the conversation itself isn't the hard part — starting it is. Would it help to just send him a calendar invite with a vague title? That removes the 'finding the right moment' escape hatch.",
                 {
                     "inferred_dimensions": {"motivation": 6.0, "anxiety_level": 3.5, "self_worth": 6.0},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "colleagues", "location": "office", "sleep": "good"},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [],
                 }),
                ("user", "That actually might work. If it's in the calendar I can't dodge it."),
                ("assistant",
                 "Then do it tonight. 30 seconds. 'James — quick sync on Henderson scope, 15 min.' Before your brain finds a reason not to. The conversation will be easier than the four weeks of avoidance that preceded it.",
                 None),
            ],
        },
        # ── Day 29: Great day ──
        {
            "day": 29, "score": 7.0, "hour": 20, "minute": 15,
            "messages": [
                ("user", "Great day. Gym felt strong, office was productive, had a long walk at lunch with Tom. He's going through a rough patch too which made me feel less alone in all this. Dinner out with Lea. Best streak I've had."),
                ("assistant",
                 "Your 7-day average is 6.2 — the highest it's been. More importantly, your floor has risen. Your lowest score this week was 5.0, which was your ceiling in week one. The structure is working and you're protecting it more consistently. The open loops are the same two: James and finances.",
                 {
                     "inferred_dimensions": {"motivation": 7.0, "anxiety_level": 2.0, "self_worth": 7.0},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "friends", "location": "office", "sleep": "good"},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [],
                 }),
            ],
        },
        # ── Day 30: Today ──
        {
            "day": 30, "score": 6.5, "hour": 20, "minute": 0,
            "messages": [
                ("user", "Decent day. Gym helped. Work was fine. Still thinking about the James thing — it's becoming the thing I think about before bed. Lea and I had a quiet evening. Feel okay overall."),
                ("assistant",
                 "Your floor has risen from 2.5 to 5.0 in a month. The structure is holding. You've gone from barely leaving the house to a consistent gym-office-social routine that reliably produces 6+ days. The two open loops are the James conversation and your finances — both have been mentioned multiple times with no action. Those are your next edges.",
                 {
                     "inferred_dimensions": {"motivation": 6.0, "anxiety_level": 3.0, "self_worth": 6.0},
                     "context_tags": {"exercise": True, "exercise_type": "gym", "social_contact": "partner", "location": "office", "sleep": "good"},
                     "factors": {"exercise": True, "socialised": True, "office": True},
                     "extracted_actions": [],
                 }),
                ("user", "Yeah. The routine stuff is on autopilot now. Those two things are the real blockers."),
                ("assistant",
                 "The fact that you can name them clearly means you're past the denial stage. The routine was your foundation — you built it. James and finances are the walls. One requires a 15-minute conversation. The other requires opening an app. Neither is as hard as the last 30 days have been.",
                 None),
            ],
        },
    ]


# ──────────────────────────────────────────────────────────────────
# Cleanup + seed functions
# ──────────────────────────────────────────────────────────────────

USER_ID = 1


def clear_existing(db):
    """Delete all data for user_id=1 from all journal-app tables."""
    from sqlalchemy import text
    print("Clearing existing demo data...")

    # Explicit list of all journal-app tables in correct delete order.
    # Some tables (daily_checkins, personal_patterns) have user_id without
    # a FK constraint, so we can't rely on FK discovery alone.
    # Order: grandchildren → children → parent
    delete_order = [
        # Grandchild tables (FK to actions, journal_sessions, etc.)
        ("action_milestones", "action_id IN (SELECT id FROM actions WHERE user_id = :uid)"),
        ("habit_logs", "user_id = :uid"),
        # Child tables with explicit or implicit user_id
        ("domain_checkins", "user_id = :uid"),
        ("journal_messages", "user_id = :uid"),
        ("journal_sessions", "user_id = :uid"),
        ("suggestion_dismissals", "user_id = :uid"),
        ("actions", "user_id = :uid"),
        ("daily_checkins", "user_id = :uid"),
        ("life_domain_scores", "user_id = :uid"),
        ("personal_patterns", "user_id = :uid"),
        ("milestones", "user_id = :uid"),
        ("audit_events", "user_id = :uid"),
        ("user_preferences", "user_id = :uid"),
    ]

    conn = db.connection()

    for table, where_clause in delete_order:
        try:
            conn.execute(text("SAVEPOINT sp_del"))
            conn.execute(text(f"DELETE FROM {table} WHERE {where_clause}"), {"uid": USER_ID})
            conn.execute(text("RELEASE SAVEPOINT sp_del"))
        except Exception:
            conn.execute(text("ROLLBACK TO SAVEPOINT sp_del"))

    # Now delete from any OTHER tables that FK to users (parent health platform)
    fk_refs = conn.execute(text("""
        SELECT DISTINCT kcu.table_name, kcu.column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc
            ON kcu.constraint_name = rc.constraint_name
        JOIN information_schema.key_column_usage rcu
            ON rc.unique_constraint_name = rcu.constraint_name
        WHERE rcu.table_name = 'users' AND rcu.column_name = 'id'
    """)).fetchall()

    already_cleared = {t for t, _ in delete_order}
    for table_name, col_name in fk_refs:
        if table_name in already_cleared:
            continue
        try:
            conn.execute(text("SAVEPOINT sp_del"))
            conn.execute(text(f"DELETE FROM {table_name} WHERE {col_name} = :uid"), {"uid": USER_ID})
            conn.execute(text("RELEASE SAVEPOINT sp_del"))
        except Exception:
            conn.execute(text("ROLLBACK TO SAVEPOINT sp_del"))

    # Finally delete the user
    try:
        conn.execute(text("SAVEPOINT sp_del"))
        conn.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": USER_ID})
        conn.execute(text("RELEASE SAVEPOINT sp_del"))
    except Exception:
        conn.execute(text("ROLLBACK TO SAVEPOINT sp_del"))

    db.commit()
    print("  ✓ Cleared")
    print("  ✓ Cleared")


def seed_user(db) -> User:
    """Create the demo user."""
    from app.config.security import hash_password
    user = User(id=USER_ID, name="Tarek", email="tarek@demo.com", hashed_password=hash_password("demo"))
    db.add(user)
    db.flush()
    return user


def seed_preferences(db):
    """Create user preferences."""
    db.add(UserPreference(
        user_id=USER_ID,
        preferred_depth_level=3,
        journal_onboarded=True,
    ))


def seed_life_domain_scores(db):
    """Create 4 life domain snapshots showing progression."""
    snapshots = [
        (1,  {"career": 3.0, "relationship": 4.0, "family": 2.0, "health": 2.0, "finance": 4.0, "social": 2.0, "purpose": 2.0}),
        (10, {"career": 3.5, "relationship": 4.0, "family": 2.5, "health": 3.5, "finance": 3.5, "social": 3.0, "purpose": 2.5}),
        (20, {"career": 4.5, "relationship": 5.0, "family": 3.0, "health": 5.0, "finance": 3.0, "social": 3.5, "purpose": 3.5}),
        (30, {"career": 5.0, "relationship": 5.0, "family": 3.0, "health": 6.0, "finance": 3.0, "social": 4.0, "purpose": 4.0}),
    ]
    count = 0
    for day_n, scores in snapshots:
        lds = LifeDomainScore(
            user_id=USER_ID,
            score_date=day(day_n).isoformat(),
            created_at=dt(day(day_n), 22, 0),
            updated_at=dt(day(day_n), 22, 0),
            **scores,
        )
        db.add(lds)
        count += 1
    return count


def seed_daily_checkins(db):
    """Create 30 daily check-ins."""
    count = 0
    for i in range(30):
        d = DAILY_DATA[i]
        checkin = DailyCheckIn(
            user_id=USER_ID,
            checkin_date=day(i + 1),
            overall_wellbeing=SCORES[i],
            notes=d["notes"],
            behaviors_json=d["behaviors"],
            context_tags_json=d["context"],
            ai_inferred_json=d["inferred"],
            word_count=len(d["notes"].split()),
            depth_level=3 if len(d["notes"].split()) > 40 else 2,
            created_at=dt(day(i + 1), 21, 0),
            updated_at=dt(day(i + 1), 21, 0),
        )
        db.add(checkin)
        count += 1
    return count


def seed_journal_sessions(db):
    """Create journal sessions with messages."""
    sessions_data = build_sessions()
    session_count = 0
    message_count = 0

    for s in sessions_data:
        d = day(s["day"])
        started = dt(d, s["hour"], s["minute"])

        session = JournalSession(
            user_id=USER_ID,
            started_at=started,
            daily_score=s["score"],
            score_confirmed_at=started + timedelta(minutes=len(s["messages"]) * 3),
            created_at=started,
        )
        db.add(session)
        db.flush()  # get session.id
        session_count += 1

        for idx, msg_tuple in enumerate(s["messages"]):
            role = msg_tuple[0]
            content = msg_tuple[1]
            analysis = msg_tuple[2] if len(msg_tuple) > 2 else None

            msg = JournalMessage(
                session_id=session.id,
                user_id=USER_ID,
                role=role,
                content=content,
                ai_analysis_json=analysis,
                created_at=started + timedelta(minutes=idx * 2),
            )
            db.add(msg)
            message_count += 1

    return session_count, message_count


def seed_actions(db):
    """Create 5 actions: 2 habits + 3 completables."""
    actions = []

    # Habit 1: Exercise
    a1 = Action(
        user_id=USER_ID,
        title="Prioritise daily exercise",
        description="Gym, run, or any physical activity. The single strongest predictor of a good day.",
        action_type="habit",
        status="active",
        source="journal_extraction",
        primary_domain="health",
        target_frequency=7,
        difficulty=2,
        sort_order=0,
        created_at=dt(day(5), 20, 30),
        updated_at=dt(day(5), 20, 30),
    )
    db.add(a1)
    actions.append(a1)

    # Habit 2: Office
    a2 = Action(
        user_id=USER_ID,
        title="Go to office on work days",
        description="Structure and social contact. WFH is the enemy of momentum.",
        action_type="habit",
        status="active",
        source="journal_extraction",
        primary_domain="career",
        target_frequency=5,
        difficulty=1,
        sort_order=1,
        created_at=dt(day(8), 19, 0),
        updated_at=dt(day(8), 19, 0),
    )
    db.add(a2)
    actions.append(a2)

    # Completable 1: James conversation
    a3 = Action(
        user_id=USER_ID,
        title="Have the scope conversation with James",
        description="Henderson project deliverables expanded from 3 to 5 without adjusting timeline. Need to flag before it becomes a failure to deliver.",
        action_type="completable",
        status="active",
        source="journal_extraction",
        primary_domain="career",
        difficulty=3,
        sort_order=2,
        created_at=dt(day(14), 21, 30),
        updated_at=dt(day(14), 21, 30),
    )
    db.add(a3)
    actions.append(a3)

    # Completable 2: Finance review
    a4 = Action(
        user_id=USER_ID,
        title="Review last month's spending",
        description="Open the bank app and look at categories. Not committing to a budget yet — just see the numbers.",
        action_type="completable",
        status="active",
        source="ai_suggestion",
        primary_domain="finance",
        difficulty=1,
        sort_order=3,
        created_at=dt(day(26), 21, 30),
        updated_at=dt(day(26), 21, 30),
    )
    db.add(a4)
    actions.append(a4)

    # Completable 3: Therapist referral (completed)
    a5 = Action(
        user_id=USER_ID,
        title="Submit therapist insurance referral",
        description="Call insurance, get GP appointment, submit referral paperwork.",
        action_type="completable",
        status="completed",
        source="journal_extraction",
        primary_domain="health",
        difficulty=2,
        sort_order=4,
        created_at=dt(day(8), 19, 30),
        updated_at=dt(day(18), 19, 30),
    )
    db.add(a5)
    actions.append(a5)

    db.flush()
    return actions


def seed_action_milestones(db, actions: list[Action]):
    """Create milestones for completable actions only. Habits get none."""
    james_action = actions[2]     # "Have the scope conversation with James"
    finance_action = actions[3]   # "Review last month's spending"
    referral_action = actions[4]  # "Submit therapist insurance referral"

    count = 0

    # James: 3 milestones, all incomplete (avoidance pattern)
    for title, order in [
        ("Prepare key points", 0),
        ("Schedule the meeting", 1),
        ("Have the conversation", 2),
    ]:
        db.add(ActionMilestone(
            action_id=james_action.id,
            title=title,
            is_completed=False,
            sort_order=order,
            created_at=dt(day(14), 21, 30),
        ))
        count += 1

    # Finance review: 3 milestones, all incomplete
    for title, order in [
        ("Download bank statements", 0),
        ("Categorise spending", 1),
        ("Identify cuts", 2),
    ]:
        db.add(ActionMilestone(
            action_id=finance_action.id,
            title=title,
            is_completed=False,
            sort_order=order,
            created_at=dt(day(26), 21, 30),
        ))
        count += 1

    # Referral: 3 milestones, all completed (action is completed)
    db.add(ActionMilestone(
        action_id=referral_action.id,
        title="Call insurance company",
        is_completed=True,
        completed_at=dt(day(10), 14, 0),
        sort_order=0,
        created_at=dt(day(8), 19, 30),
    ))
    count += 1

    db.add(ActionMilestone(
        action_id=referral_action.id,
        title="Submit referral documents",
        is_completed=True,
        completed_at=dt(day(12), 16, 0),
        sort_order=1,
        created_at=dt(day(8), 19, 30),
    ))
    count += 1

    db.add(ActionMilestone(
        action_id=referral_action.id,
        title="GP appointment attended",
        is_completed=True,
        completed_at=dt(day(18), 11, 0),
        sort_order=2,
        created_at=dt(day(8), 19, 30),
    ))
    count += 1

    return count


def seed_habit_logs(db, actions: list[Action]):
    """Create habit logs for the two habit actions."""
    exercise_action = actions[0]  # "Prioritise daily exercise" — created day 5
    office_action = actions[1]     # "Go to office on work days" — created day 8

    count = 0

    # Exercise habit: logs from day 5 to day 30
    for i in range(4, 30):  # index 4 = day 5
        d = day(i + 1)
        data = DAILY_DATA[i]
        exercised = data["behaviors"].get("exercise", False)
        db.add(HabitLog(
            action_id=exercise_action.id,
            user_id=USER_ID,
            log_date=d.isoformat(),
            completed=exercised,
            created_at=dt(d, 22, 0),
        ))
        count += 1

    # Office habit: logs from day 8 to day 30, weekdays only
    for i in range(7, 30):  # index 7 = day 8
        d = day(i + 1)
        # Skip weekends
        if d.weekday() >= 5:  # Saturday=5, Sunday=6
            continue
        data = DAILY_DATA[i]
        went_to_office = data["behaviors"].get("office", False)
        db.add(HabitLog(
            action_id=office_action.id,
            user_id=USER_ID,
            log_date=d.isoformat(),
            completed=went_to_office,
            created_at=dt(d, 22, 0),
        ))
        count += 1

    return count


def seed_personal_patterns(db):
    """Create 4 detected patterns."""
    patterns = [
        # 1. Exercise = Floor (confirmed)
        PersonalPattern(
            user_id=USER_ID,
            pattern_type="correlation",
            input_signals_json=["exercise"],
            output_signal="overall_wellbeing",
            relationship_json={
                "pattern_name": "Exercise = Floor",
                "description": "Never scored below 5.5 on an exercise day. Average 6.2 vs 4.1 without.",
                "icon": "🛡️",
                "data_summary": "18 exercise days: min 5.5, avg 6.2. 12 non-exercise days: min 2.5, avg 4.1",
                "mean_with": 6.2,
                "mean_without": 4.1,
                "effect_size": 1.4,
                "exceptions": 0,
            },
            times_observed=18,
            times_confirmed=17,
            current_confidence=0.85,
            first_detected=dt(day(10)),
            last_confirmed=dt(day(30)),
            status="confirmed",
            user_acknowledged=True,
            created_at=dt(day(10)),
            updated_at=dt(day(30)),
        ),
        # 2. Social Contact Boost (confirmed)
        PersonalPattern(
            user_id=USER_ID,
            pattern_type="correlation",
            input_signals_json=["socialised"],
            output_signal="overall_wellbeing",
            relationship_json={
                "pattern_name": "Social Contact Boost",
                "description": "Average score 1.2 points higher on social days. Social contact is your second strongest positive factor.",
                "icon": "🚀",
                "mean_with": 6.4,
                "mean_without": 5.2,
                "effect_size": 1.1,
                "exceptions": 1,
            },
            times_observed=20,
            times_confirmed=18,
            current_confidence=0.78,
            first_detected=dt(day(12)),
            last_confirmed=dt(day(30)),
            status="confirmed",
            user_acknowledged=True,
            created_at=dt(day(12)),
            updated_at=dt(day(30)),
        ),
        # 3. The Crash Pattern (confirmed)
        PersonalPattern(
            user_id=USER_ID,
            pattern_type="correlation",
            input_signals_json=["isolated"],
            output_signal="overall_wellbeing",
            relationship_json={
                "pattern_name": "The Crash Pattern",
                "description": "Isolation + no exercise = crash. Average 3.2 on days with neither.",
                "icon": "📉",
                "mean_with": 3.2,
                "mean_without": 6.0,
                "effect_size": -1.8,
                "exceptions": 0,
            },
            times_observed=8,
            times_confirmed=8,
            current_confidence=0.82,
            first_detected=dt(day(9)),
            last_confirmed=dt(day(27)),
            status="confirmed",
            user_acknowledged=True,
            created_at=dt(day(9)),
            updated_at=dt(day(27)),
        ),
        # 4. Office Routine (hypothesis)
        PersonalPattern(
            user_id=USER_ID,
            pattern_type="correlation",
            input_signals_json=["office"],
            output_signal="overall_wellbeing",
            relationship_json={
                "pattern_name": "Office Routine",
                "description": "Average 6.1 on office days vs 4.8 on WFH days. Structure seems to help.",
                "icon": "🏢",
                "mean_with": 6.1,
                "mean_without": 4.8,
                "effect_size": 0.9,
                "exceptions": 2,
            },
            times_observed=15,
            times_confirmed=12,
            current_confidence=0.65,
            first_detected=dt(day(14)),
            last_confirmed=dt(day(30)),
            status="hypothesis",
            user_acknowledged=False,
            created_at=dt(day(14)),
            updated_at=dt(day(30)),
        ),
    ]

    for p in patterns:
        db.add(p)
    return len(patterns)


def seed_milestones(db):
    """Create achievement milestones."""
    milestones = [
        Milestone(
            user_id=USER_ID,
            milestone_type="recovery",
            detected_date=day(10),
            description="Recovered from 3.0 to 6.0 within 24 hours",
            category="achievement",
            metadata_json={"from_score": 3.0, "to_score": 6.0, "days": 1},
            created_at=dt(day(10), 22, 0),
        ),
        Milestone(
            user_id=USER_ID,
            milestone_type="pattern_confirmed",
            detected_date=day(15),
            description="Exercise = Floor pattern confirmed across 10+ entries",
            category="progress",
            metadata_json={"pattern": "exercise_floor", "entries": 10},
            created_at=dt(day(15), 22, 0),
        ),
        Milestone(
            user_id=USER_ID,
            milestone_type="score_streak",
            detected_date=day(25),
            description="5 consecutive days above 5.5",
            category="consistency",
            metadata_json={"streak_length": 5, "threshold": 5.5},
            created_at=dt(day(25), 22, 0),
        ),
        Milestone(
            user_id=USER_ID,
            milestone_type="score_streak",
            detected_date=day(30),
            description="8 consecutive days above 5.0",
            category="consistency",
            metadata_json={"streak_length": 8, "threshold": 5.0},
            created_at=dt(day(30), 22, 0),
        ),
    ]
    for m in milestones:
        db.add(m)
    return len(milestones)


def seed_domain_checkins(db):
    """Create 4 explicit domain check-ins matching life domain score snapshots."""
    checkins = [
        (1,  {"career": 3.0, "relationship": 4.0, "family": 2.0, "health": 2.0, "finance": 4.0, "social": 2.0, "purpose": 2.0}),
        (10, {"career": 3.5, "relationship": 4.0, "family": 2.5, "health": 3.5, "finance": 3.5, "social": 3.0, "purpose": 2.5}),
        (20, {"career": 4.5, "relationship": 5.0, "family": 3.0, "health": 5.0, "finance": 3.0, "social": 3.5, "purpose": 3.5}),
        (30, {"career": 5.0, "relationship": 5.0, "family": 3.0, "health": 6.0, "finance": 3.0, "social": 4.0, "purpose": 4.0}),
    ]
    count = 0
    for day_n, scores in checkins:
        dc = DomainCheckin(
            user_id=USER_ID,
            checkin_date=day(day_n).isoformat(),
            created_at=dt(day(day_n), 22, 30),
            **scores,
        )
        db.add(dc)
        count += 1
    return count


# ──────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  AI Journal App — Seed Demo Data")
    print("=" * 60)
    print(f"  Story: 30 days of journalling ({day(1)} → {day(30)})")
    print()

    db = SessionLocal()
    try:
        # 1. Clear existing
        clear_existing(db)

        # 2. User + prefs
        seed_user(db)
        seed_preferences(db)
        db.flush()
        print("  ✓ User + preferences")

        # 3. Life domain scores (4 snapshots)
        n = seed_life_domain_scores(db)
        print(f"  ✓ Life domain scores ({n} snapshots)")

        # 4. Domain check-ins (4)
        n = seed_domain_checkins(db)
        print(f"  ✓ Domain check-ins ({n})")

        # 5. Daily check-ins (30)
        n = seed_daily_checkins(db)
        print(f"  ✓ Daily check-ins ({n} days)")

        # 6. Journal sessions + messages
        ns, nm = seed_journal_sessions(db)
        print(f"  ✓ Journal sessions ({ns}) with messages ({nm})")

        # 7. Actions (5)
        actions = seed_actions(db)
        print(f"  ✓ Actions ({len(actions)}): 2 habits, 3 completables")

        # 8. Action milestones
        n = seed_action_milestones(db, actions)
        print(f"  ✓ Action milestones ({n})")

        # 9. Habit logs
        n = seed_habit_logs(db, actions)
        print(f"  ✓ Habit logs ({n})")

        # 10. Personal patterns (4)
        n = seed_personal_patterns(db)
        print(f"  ✓ Personal patterns ({n})")

        # 11. Achievement milestones (4)
        n = seed_milestones(db)
        print(f"  ✓ Achievement milestones ({n})")

        # Commit everything
        db.commit()
        print()
        print("=" * 60)
        print("  ✅ Seed complete!")
        print("=" * 60)

        # Summary
        print()
        print("  Story arc:")
        print(f"    Week 1 (volatile):    avg {sum(SCORES[0:7])/7:.1f}  range {min(SCORES[0:7])}-{max(SCORES[0:7])}")
        print(f"    Week 2 (building):    avg {sum(SCORES[7:14])/7:.1f}  range {min(SCORES[7:14])}-{max(SCORES[7:14])}")
        print(f"    Week 3 (stabilising): avg {sum(SCORES[14:21])/7:.1f}  range {min(SCORES[14:21])}-{max(SCORES[14:21])}")
        print(f"    Week 4 (rising):      avg {sum(SCORES[21:28])/7:.1f}  range {min(SCORES[21:28])}-{max(SCORES[21:28])}")
        print(f"    Recent:               avg {sum(SCORES[28:30])/2:.1f}")
        print()

        # Count exercise days and consistency
        exercise_days = sum(1 for d in DAILY_DATA[4:] if d["behaviors"].get("exercise", False))
        total_from_day5 = len(DAILY_DATA[4:])
        print(f"  Exercise consistency: {exercise_days}/{total_from_day5} days ({100*exercise_days/total_from_day5:.0f}%)")

        office_weekdays = 0
        office_total = 0
        for i in range(7, 30):
            d = day(i + 1)
            if d.weekday() < 5:
                office_total += 1
                if DAILY_DATA[i]["behaviors"].get("office", False):
                    office_weekdays += 1
        print(f"  Office consistency:  {office_weekdays}/{office_total} weekdays ({100*office_weekdays/office_total:.0f}%)")

        print()
        print("  Avoidance patterns:")
        print("    James conversation: 4 mentions (days 7, 14, 21, 28), 0 action")
        print("    Finance review:     3 mentions (days 12, 20, 26), 0 action")
        print()

    except Exception as e:
        db.rollback()
        print(f"\n  ❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
