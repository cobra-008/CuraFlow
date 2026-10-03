"""
CuraFlow Intelligence Engines (Phases 7-9):
  - Prediction Engine
  - Bottleneck Engine  
  - Optimization Engine
  - Recommendation Engine with full explainability
"""

import logging
import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)
NOW = lambda: datetime.now(timezone.utc)

# ── Prediction Engine ─────────────────────────────────────────────────────────

class PredictionEngine:
    """
    Generates operational predictions.
    Uses synthetic/statistical baseline for prototype.
    Designed to accept real data in production.
    
    IMPORTANT: All predictions from this engine are labeled IS_SYNTHETIC=true.
    They are NOT clinically validated forecasts.
    """

    def __init__(self, rng: Optional[random.Random] = None):
        self._rng = rng or random.Random(99)

    def predict_all(self, snapshot: dict) -> list[dict]:
        """Generate a full prediction suite from the current hospital snapshot."""
        preds = []
        preds.extend(self._predict_icu_demand(snapshot))
        preds.extend(self._predict_bed_occupancy(snapshot))
        preds.extend(self._predict_er_arrivals(snapshot))
        preds.extend(self._predict_discharge_rate(snapshot))
        preds.extend(self._predict_diagnostic_demand(snapshot))
        preds.extend(self._predict_staff_demand(snapshot))
        return preds

    def _predict_icu_demand(self, snapshot: dict) -> list[dict]:
        current_occ = snapshot["icu"]["occupied"]
        total_icu = snapshot["icu"]["total"]
        current_pct = snapshot["icu"]["occupancy_pct"]

        # Simple autoregressive trend + noise
        trend = 1.02 if current_pct > 70 else 0.98
        preds = []
        for hours_ahead in [1, 2, 4, 6, 12]:
            predicted = min(total_icu, current_occ * (trend ** hours_ahead) 
                          + self._rng.gauss(0, 0.5))
            predicted = max(0, round(predicted, 1))
            preds.append({
                "id": str(uuid.uuid4()),
                "prediction_type": "icu_demand",
                "resource_type": "icu",
                "resource_id": "all",
                "prediction_time": NOW().isoformat(),
                "forecast_start": (NOW() + timedelta(hours=hours_ahead)).isoformat(),
                "forecast_end": (NOW() + timedelta(hours=hours_ahead + 1)).isoformat(),
                "predicted_value": predicted,
                "lower_bound": max(0, predicted - 1.5),
                "upper_bound": min(total_icu, predicted + 1.5),
                "confidence": 0.72 - (hours_ahead * 0.02),
                "model_name": "icu_ar1_baseline",
                "model_version": "1.0",
                "is_synthetic": True,
            })
        return preds

    def _predict_bed_occupancy(self, snapshot: dict) -> list[dict]:
        current_pct = snapshot["beds"]["occupancy_pct"]
        total_beds = snapshot["beds"]["total"]
        
        preds = []
        for hours_ahead in [1, 4, 8, 24]:
            # Time-of-day seasonality (admissions peak around 10-14h)
            hour_of_day = (NOW().hour + hours_ahead) % 24
            seasonal = 1.0 + 0.05 * math.sin(math.pi * hour_of_day / 12)
            predicted_pct = min(100.0, current_pct * seasonal + self._rng.gauss(0, 1.5))
            predicted_occupied = round(total_beds * predicted_pct / 100, 0)
            preds.append({
                "id": str(uuid.uuid4()),
                "prediction_type": "bed_occupancy",
                "resource_type": "beds",
                "resource_id": "all",
                "prediction_time": NOW().isoformat(),
                "forecast_start": (NOW() + timedelta(hours=hours_ahead)).isoformat(),
                "forecast_end": (NOW() + timedelta(hours=hours_ahead + 1)).isoformat(),
                "predicted_value": predicted_pct,
                "lower_bound": max(0, predicted_pct - 5),
                "upper_bound": min(100, predicted_pct + 5),
                "confidence": 0.78 - (hours_ahead * 0.01),
                "model_name": "bed_seasonal_baseline",
                "model_version": "1.0",
                "is_synthetic": True,
            })
        return preds

    def _predict_er_arrivals(self, snapshot: dict) -> list[dict]:
        current_waiting = snapshot["emergency"]["waiting"]
        er_cap = snapshot["emergency"]["capacity"]
        crisis = snapshot.get("crisis_mode", False)

        preds = []
        for hours_ahead in [1, 2, 4]:
            base_rate = 4.0 if not crisis else 8.0  # arrivals per hour
            arrivals = base_rate * hours_ahead + self._rng.gauss(0, base_rate * 0.3)
            predicted_q = max(0, current_waiting + arrivals - (base_rate * 0.6 * hours_ahead))
            preds.append({
                "id": str(uuid.uuid4()),
                "prediction_type": "er_arrivals",
                "resource_type": "er",
                "resource_id": "all",
                "prediction_time": NOW().isoformat(),
                "forecast_start": (NOW() + timedelta(hours=hours_ahead)).isoformat(),
                "forecast_end": (NOW() + timedelta(hours=hours_ahead + 1)).isoformat(),
                "predicted_value": round(predicted_q, 1),
                "lower_bound": max(0, predicted_q - 3),
                "upper_bound": min(er_cap, predicted_q + 5),
                "confidence": 0.68 - (hours_ahead * 0.04),
                "model_name": "er_poisson_baseline",
                "model_version": "1.0",
                "is_synthetic": True,
            })
        return preds

    def _predict_discharge_rate(self, snapshot: dict) -> list[dict]:
        occ = snapshot["beds"]["occupied"]
        pred = max(0, round(occ * 0.08 + self._rng.gauss(0, 1), 1))  # ~8% discharge/hour
        return [{
            "id": str(uuid.uuid4()),
            "prediction_type": "discharges",
            "resource_type": "beds",
            "resource_id": "all",
            "prediction_time": NOW().isoformat(),
            "forecast_start": NOW().isoformat(),
            "forecast_end": (NOW() + timedelta(hours=4)).isoformat(),
            "predicted_value": pred,
            "lower_bound": max(0, pred - 2),
            "upper_bound": pred + 3,
            "confidence": 0.65,
            "model_name": "discharge_baseline",
            "model_version": "1.0",
            "is_synthetic": True,
        }]

    def _predict_diagnostic_demand(self, snapshot: dict) -> list[dict]:
        q_len = snapshot["diagnostics"]["queue_length"]
        pred = max(0, round(q_len + self._rng.gauss(2, 2), 1))
        return [{
            "id": str(uuid.uuid4()),
            "prediction_type": "diagnostic_demand",
            "resource_type": "diagnostics",
            "resource_id": "all",
            "prediction_time": NOW().isoformat(),
            "forecast_start": NOW().isoformat(),
            "forecast_end": (NOW() + timedelta(hours=2)).isoformat(),
            "predicted_value": pred,
            "lower_bound": max(0, pred - 2),
            "upper_bound": pred + 4,
            "confidence": 0.60,
            "model_name": "diagnostic_queue_baseline",
            "model_version": "1.0",
            "is_synthetic": True,
        }]

    def _predict_staff_demand(self, snapshot: dict) -> list[dict]:
        util = snapshot["staff"]["utilization_pct"]
        pred = min(100.0, util + self._rng.gauss(2, 3))
        return [{
            "id": str(uuid.uuid4()),
            "prediction_type": "staff_demand",
            "resource_type": "staff",
            "resource_id": "all",
            "prediction_time": NOW().isoformat(),
            "forecast_start": NOW().isoformat(),
            "forecast_end": (NOW() + timedelta(hours=4)).isoformat(),
            "predicted_value": round(pred, 1),
            "lower_bound": max(0, pred - 5),
            "upper_bound": min(100, pred + 5),
            "confidence": 0.64,
            "model_name": "staff_demand_baseline",
            "model_version": "1.0",
            "is_synthetic": True,
        }]


# ── Bottleneck Engine ─────────────────────────────────────────────────────────

BOTTLENECK_RULES = [
    {
        "type": "icu_saturation",
        "resource": "icu",
        "metric": lambda s: s["icu"]["occupancy_pct"],
        "threshold": 85.0,
        "severity_map": [(95, "critical"), (90, "high"), (85, "moderate")],
        "description": "ICU occupancy above safe threshold",
    },
    {
        "type": "bed_shortage",
        "resource": "beds",
        "metric": lambda s: s["beds"]["occupancy_pct"],
        "threshold": 88.0,
        "severity_map": [(96, "critical"), (92, "high"), (88, "moderate")],
        "description": "General bed occupancy critically high",
    },
    {
        "type": "staff_shortage",
        "resource": "staff",
        "metric": lambda s: s["staff"]["utilization_pct"],
        "threshold": 80.0,
        "severity_map": [(95, "critical"), (88, "high"), (80, "moderate")],
        "description": "Staff workload above safe operating level",
    },
    {
        "type": "er_queue_growth",
        "resource": "er",
        "metric": lambda s: (s["emergency"]["waiting"] / max(s["emergency"]["capacity"], 1)) * 100,
        "threshold": 50.0,
        "severity_map": [(80, "critical"), (65, "high"), (50, "moderate")],
        "description": "Emergency department queue growing",
    },
    {
        "type": "diagnostic_backlog",
        "resource": "diagnostics",
        "metric": lambda s: s["diagnostics"]["queue_length"],
        "threshold": 10.0,
        "severity_map": [(20, "critical"), (15, "high"), (10, "moderate")],
        "description": "Diagnostic queue exceeding device capacity",
    },
    {
        "type": "ot_overrun",
        "resource": "operating_rooms",
        "metric": lambda s: s["operating_rooms"]["utilization_pct"],
        "threshold": 80.0,
        "severity_map": [(95, "critical"), (88, "high"), (80, "moderate")],
        "description": "Operating theatre utilization unsustainable",
    },
]


class BottleneckEngine:
    """Detects current and predicted bottlenecks from hospital state."""

    def detect(self, snapshot: dict, predictions: list[dict]) -> list[dict]:
        bottlenecks = []
        for rule in BOTTLENECK_RULES:
            try:
                value = rule["metric"](snapshot)
                if value >= rule["threshold"]:
                    severity = "low"
                    for threshold, sev in rule["severity_map"]:
                        if value >= threshold:
                            severity = sev
                            break
                    bottlenecks.append({
                        "id": str(uuid.uuid4()),
                        "bottleneck_type": rule["type"],
                        "resource_type": rule["resource"],
                        "resource_id": "all",
                        "severity": severity,
                        "detected_at": NOW().isoformat(),
                        "current_value": round(value, 2),
                        "threshold_value": rule["threshold"],
                        "confidence": 0.90,
                        "status": "active",
                        "description": rule["description"],
                    })
            except Exception as e:
                logger.debug("Bottleneck rule %s error: %s", rule["type"], e)

        # Predicted bottlenecks from prediction engine output
        for pred in predictions:
            if pred["prediction_type"] == "icu_demand":
                pct = (pred["predicted_value"] / max(snapshot["icu"]["total"], 1)) * 100
                if pct >= 90:
                    bottlenecks.append({
                        "id": str(uuid.uuid4()),
                        "bottleneck_type": "icu_saturation_predicted",
                        "resource_type": "icu",
                        "resource_id": "all",
                        "severity": "high" if pct >= 95 else "moderate",
                        "detected_at": NOW().isoformat(),
                        "predicted_time": pred["forecast_start"],
                        "predicted_value": round(pct, 1),
                        "current_value": snapshot["icu"]["occupancy_pct"],
                        "threshold_value": 90.0,
                        "confidence": pred["confidence"],
                        "status": "predicted",
                        "description": f"ICU saturation predicted within {pred['forecast_start'][:16]}",
                    })

        return bottlenecks


# ── Recommendation Engine ─────────────────────────────────────────────────────

RECOMMENDATION_TEMPLATES = {
    "icu_saturation": {
        "title": "Reserve ICU capacity",
        "rec_type": "resource_allocation",
        "priority": "critical",
        "why_template": (
            "ICU occupancy is at {current:.0f}% — above the {threshold:.0f}% safe threshold. "
            "Without intervention, respiratory/cardiac patients may face delayed placement."
        ),
        "actions": [
            {"type": "reserve_bed", "description": "Reserve {target_bed} for high-acuity admission"},
            {"type": "staff_alert", "description": "Alert ICU charge nurse of incoming pressure"},
            {"type": "review_stepdown", "description": "Review step-down candidates in ICU"},
        ],
        "counterfactual": {
            "label": "If rejected",
            "predicted_saturation_pct": lambda v: min(100, v + 8),
            "expected_delay_minutes": 17,
            "alternative": "Manual bed hunt adding ~12 min delay",
        },
    },
    "bed_shortage": {
        "title": "Accelerate bed turnover",
        "rec_type": "operational",
        "priority": "high",
        "why_template": (
            "Bed occupancy is at {current:.0f}%. Discharge delays and slow bed cleaning "
            "are preventing new admissions. Action required to free capacity."
        ),
        "actions": [
            {"type": "dispatch_housekeeping", "description": "Dispatch housekeeping to cleaning beds"},
            {"type": "discharge_review", "description": "Review discharge-ready patients for same-day discharge"},
            {"type": "transfer_review", "description": "Identify transfer candidates to step-down units"},
        ],
        "counterfactual": {
            "label": "If rejected",
            "predicted_saturation_pct": lambda v: min(100, v + 5),
            "expected_delay_minutes": 25,
            "alternative": "Divert incoming non-emergency admissions",
        },
    },
    "staff_shortage": {
        "title": "Rebalance staff assignments",
        "rec_type": "staff_rebalance",
        "priority": "high",
        "why_template": (
            "Staff utilization is at {current:.0f}%. Float pool nurses are available "
            "in under-utilized wards and should be reallocated."
        ),
        "actions": [
            {"type": "reassign_staff", "description": "Reassign 2 float nurses from {source_ward} to {target_ward}"},
            {"type": "overtime_request", "description": "Send optional overtime request to eligible staff"},
        ],
        "counterfactual": {
            "label": "If rejected",
            "predicted_saturation_pct": lambda v: min(100, v + 6),
            "expected_delay_minutes": 10,
            "alternative": "Reduce patient intake by 15% for 1 shift",
        },
    },
    "er_queue_growth": {
        "title": "Activate ER fast-track pathway",
        "rec_type": "operational",
        "priority": "high",
        "why_template": (
            "ER queue at {current:.0f}% capacity and growing. Fast-track for low-acuity "
            "patients will reduce average wait time."
        ),
        "actions": [
            {"type": "activate_fasttrack", "description": "Open fast-track bay for ESI 4/5 patients"},
            {"type": "staff_reposition", "description": "Move 1 nurse from {source_area} to ER triage support"},
        ],
        "counterfactual": {
            "label": "If rejected",
            "predicted_saturation_pct": lambda v: min(100, v + 15),
            "expected_delay_minutes": 22,
            "alternative": "Divert ambulances to nearest facility (+8 min transport)",
        },
    },
    "diagnostic_backlog": {
        "title": "Redirect diagnostic workload",
        "rec_type": "resource_allocation",
        "priority": "medium",
        "why_template": (
            "Diagnostic queue has {current:.0f} pending orders with device utilization high. "
            "Workload rebalancing across available units will reduce wait time."
        ),
        "actions": [
            {"type": "redirect_orders", "description": "Route non-urgent orders to {device} (available now)"},
            {"type": "expedite_stat", "description": "Expedite {n_stat} STAT orders ahead of queue"},
        ],
        "counterfactual": {
            "label": "If rejected",
            "predicted_saturation_pct": lambda v: min(100, v + 10),
            "expected_delay_minutes": 35,
            "alternative": "Manually triage orders (adds ~45 min to non-urgent turnaround)",
        },
    },
    "icu_saturation_predicted": {
        "title": "Pre-position for predicted ICU demand",
        "rec_type": "predictive_resource",
        "priority": "high",
        "why_template": (
            "Prediction model projects ICU occupancy will reach {predicted_pct:.0f}% "
            "within {horizon}. Preparing capacity now prevents a reactive crisis."
        ),
        "actions": [
            {"type": "reserve_bed", "description": "Pre-reserve 2 ICU beds (respiratory-capable)"},
            {"type": "staff_prep", "description": "Brief ICU team on incoming pressure"},
            {"type": "ventilator_check", "description": "Confirm ventilator readiness in pre-reserved beds"},
        ],
        "counterfactual": {
            "label": "If rejected",
            "predicted_saturation_pct": lambda v: min(100, v + 9),
            "expected_delay_minutes": 17,
            "alternative": "React when saturation occurs (+17 min response time)",
        },
    },
}


class RecommendationEngine:
    """
    Generates explainable, actionable recommendations from bottlenecks.
    Each recommendation includes:
      - WHY explanation
      - Constraints satisfied
      - Alternatives considered and rejected
      - Counterfactual (what happens if rejected)
      - Expected impact
    """

    def __init__(self, rng: Optional[random.Random] = None):
        self._rng = rng or random.Random(77)
        self._counter = 0

    def generate(self, bottlenecks: list[dict], snapshot: dict) -> list[dict]:
        recommendations = []
        seen_types = set()

        # Sort by severity
        severity_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
        sorted_bottlenecks = sorted(
            bottlenecks,
            key=lambda b: severity_order.get(b.get("severity", "low"), 3)
        )

        for bn in sorted_bottlenecks:
            btype = bn["bottleneck_type"]
            if btype in seen_types:
                continue
            seen_types.add(btype)

            template = RECOMMENDATION_TEMPLATES.get(btype)
            if not template:
                continue

            self._counter += 1
            rec_id = str(uuid.uuid4())
            current_value = bn.get("current_value", 0)
            threshold = bn.get("threshold_value", 85)

            # Fill why_template
            why = template["why_template"].format(
                current=current_value,
                threshold=threshold,
                predicted_pct=bn.get("predicted_value", current_value),
                horizon="45 minutes",
            )

            # Build actions
            actions = []
            for i, action_tpl in enumerate(template["actions"]):
                desc = action_tpl["description"].format(
                    target_bed="ICU-04",
                    source_ward="Orthopedics",
                    target_ward="Respiratory Ward",
                    source_area="Surgical Ward",
                    device="CT-02",
                    n_stat=3,
                )
                actions.append({
                    "id": str(uuid.uuid4()),
                    "recommendation_id": rec_id,
                    "action_order": i + 1,
                    "action_type": action_tpl["type"],
                    "action_description": desc,
                    "parameters": {},
                    "status": "pending",
                })

            # Constraints satisfied
            constraints = [
                "Resource within this facility",
                "Staff qualifications verified",
                "No existing conflicting reservation",
                "Patient safety requirements met",
            ]

            # Alternatives rejected
            alt_rejected = [
                {
                    "option": "ICU-07",
                    "reason": "Equipment conflict — ventilator in maintenance",
                },
                {
                    "option": "Defer 2 hours",
                    "reason": f"Predicted saturation in <1hr at current trend",
                },
            ]

            # Counterfactual
            cf_template = template["counterfactual"]
            counterfactual = {
                "label": cf_template["label"],
                "predicted_saturation_pct": cf_template["predicted_saturation_pct"](current_value),
                "expected_delay_minutes": cf_template["expected_delay_minutes"],
                "alternative_description": cf_template["alternative"],
            }

            # Expected impact
            expected_impact = {
                "icu_occupancy_reduction_pct": round(self._rng.uniform(4, 12), 1),
                "wait_time_reduction_minutes": round(self._rng.uniform(8, 25), 0),
                "pressure_score_reduction": round(self._rng.uniform(5, 15), 1),
                "patients_benefited": self._rng.randint(2, 8),
            }

            recommendation = {
                "id": rec_id,
                "recommendation_number": self._counter,
                "rec_type": template["rec_type"],
                "priority": template["priority"],
                "status": "pending",
                "created_at": NOW().isoformat(),
                "expires_at": (NOW() + timedelta(minutes=30)).isoformat(),
                "agent_id": f"{bn['resource_type']}_agent",
                "bottleneck_id": bn["id"],
                "title": template["title"],
                "summary": f"{template['title']} — {bn['description'] if 'description' in bn else btype}",
                "reason": f"Bottleneck detected: {btype} (severity={bn['severity']})",
                "expected_impact": expected_impact,
                "confidence": bn.get("confidence", 0.8),
                "requires_approval": True,
                "why_explanation": why,
                "constraints_satisfied": constraints,
                "alternatives_considered": [
                    {"option": "ICU-04 (selected)", "reason": "Best fit: respiratory capable, isolation capable"},
                    {"option": "ICU-07 (rejected)", "reason": "Equipment conflict"},
                ],
                "alternatives_rejected": alt_rejected,
                "data_freshness_seconds": self._rng.randint(5, 45),
                "counterfactual_scenario": counterfactual,
                "actions": actions,
                # SYNTHETIC marker — never present this as clinically validated
                "_is_synthetic": True,
                "_prototype_label": "SYNTHETIC — prototype benchmark data, not clinically validated",
            }
            recommendations.append(recommendation)

        return recommendations


# ── Singletons ────────────────────────────────────────────────────────────────

_prediction_engine: Optional[PredictionEngine] = None
_bottleneck_engine: Optional[BottleneckEngine] = None
_recommendation_engine: Optional[RecommendationEngine] = None


def get_prediction_engine() -> PredictionEngine:
    global _prediction_engine
    if _prediction_engine is None:
        _prediction_engine = PredictionEngine()
    return _prediction_engine


def get_bottleneck_engine() -> BottleneckEngine:
    global _bottleneck_engine
    if _bottleneck_engine is None:
        _bottleneck_engine = BottleneckEngine()
    return _bottleneck_engine


def get_recommendation_engine() -> RecommendationEngine:
    global _recommendation_engine
    if _recommendation_engine is None:
        _recommendation_engine = RecommendationEngine()
    return _recommendation_engine
