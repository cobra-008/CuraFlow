import random

def get_surge_probability(er_patient_count: int, available_beds: int) -> float:
    """
    Lightweight mock RL model to predict surge probability based on current ER metrics.
    In a real scenario, this would load a trained stable-baselines3 model or neural net.
    """
    if er_patient_count == 0:
        return 0.0
        
    # Mock simple linear relationship with some random noise to simulate a model
    ratio = er_patient_count / max(1, available_beds)
    
    # Base probability increases as patients outweigh beds
    base_prob = min(0.95, ratio * 0.3)
    
    # Add RL exploration noise
    noise = random.uniform(-0.1, 0.1)
    
    return max(0.0, min(1.0, base_prob + noise))

def predict_surge(er_patient_count: int, available_beds: int) -> bool:
    """Returns True if a surge is predicted (probability > 0.75)."""
    prob = get_surge_probability(er_patient_count, available_beds)
    return prob > 0.75
