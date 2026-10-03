-- ============================================================
-- CuraFlow Phase 2: Operational Extension Migration
-- Migration: 095_curaflow_operational_layer.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS hospilot.staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_code text NOT NULL,
    name_token text NOT NULL,
    display_name text,
    role text NOT NULL,
    department_id uuid,
    branch_id uuid,
    status text NOT NULL DEFAULT 'active',
    current_location text,
    shift_start timestamptz,
    shift_end timestamptz,
    employment_type text DEFAULT 'full_time',
    max_workload integer DEFAULT 4,
    current_workload integer DEFAULT 0,
    available_from timestamptz,
    available_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT staff_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.staff_skills (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES hospilot.staff(id) ON DELETE CASCADE,
    skill_code text NOT NULL,
    skill_name text NOT NULL,
    qualification_level text DEFAULT 'basic',
    certification_expiry date,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT staff_skills_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.staff_assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES hospilot.staff(id) ON DELETE CASCADE,
    department_id uuid,
    ward text,
    patient_token text,
    admission_id uuid,
    task_id text,
    start_time timestamptz NOT NULL DEFAULT now(),
    end_time timestamptz,
    workload_units integer DEFAULT 1,
    status text NOT NULL DEFAULT 'active',
    CONSTRAINT staff_assignments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.operating_rooms (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    branch_id uuid,
    room_code text NOT NULL,
    name text NOT NULL,
    specialty text,
    status text NOT NULL DEFAULT 'available',
    available_from timestamptz,
    equipment_profile jsonb DEFAULT '[]',
    emergency_capable boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT operating_rooms_pkey PRIMARY KEY (id),
    CONSTRAINT operating_rooms_room_code_unique UNIQUE (room_code)
);

CREATE TABLE IF NOT EXISTS hospilot.ot_schedule (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ot_id uuid NOT NULL REFERENCES hospilot.operating_rooms(id) ON DELETE CASCADE,
    surgery_id uuid,
    patient_token text,
    procedure_name text,
    scheduled_start timestamptz NOT NULL,
    scheduled_end timestamptz NOT NULL,
    actual_start timestamptz,
    actual_end timestamptz,
    estimated_duration_minutes integer,
    actual_duration_minutes integer,
    priority text DEFAULT 'elective',
    status text NOT NULL DEFAULT 'scheduled',
    emergency_reserve boolean NOT NULL DEFAULT false,
    lead_surgeon_token text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ot_schedule_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.diagnostic_devices (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    device_code text NOT NULL,
    device_name text NOT NULL,
    device_type text NOT NULL,
    department_id uuid,
    location text,
    status text NOT NULL DEFAULT 'available',
    capacity_per_hour integer DEFAULT 3,
    specialties text[] DEFAULT '{}',
    emergency_capable boolean NOT NULL DEFAULT false,
    maintenance_start timestamptz,
    maintenance_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT diagnostic_devices_pkey PRIMARY KEY (id),
    CONSTRAINT diagnostic_devices_code_unique UNIQUE (device_code)
);

CREATE TABLE IF NOT EXISTS hospilot.diagnostic_queue (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid,
    device_id uuid NOT NULL REFERENCES hospilot.diagnostic_devices(id) ON DELETE CASCADE,
    patient_token text,
    priority text NOT NULL DEFAULT 'routine',
    queued_at timestamptz NOT NULL DEFAULT now(),
    estimated_start timestamptz,
    estimated_completion timestamptz,
    actual_start timestamptz,
    actual_completion timestamptz,
    status text NOT NULL DEFAULT 'waiting',
    CONSTRAINT diagnostic_queue_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.resource_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    event_id text UNIQUE,
    event_type text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    patient_token text,
    admission_id uuid,
    event_timestamp timestamptz NOT NULL DEFAULT now(),
    previous_state jsonb,
    new_state jsonb,
    source text DEFAULT 'system',
    payload jsonb DEFAULT '{}',
    confidence numeric(4,3) DEFAULT 1.0,
    processed boolean NOT NULL DEFAULT false,
    CONSTRAINT resource_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS resource_events_type_idx ON hospilot.resource_events(event_type);
CREATE INDEX IF NOT EXISTS resource_events_resource_idx ON hospilot.resource_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS resource_events_ts_idx ON hospilot.resource_events(event_timestamp DESC);

CREATE TABLE IF NOT EXISTS hospilot.hospital_state (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    branch_id uuid,
    snapshot_at timestamptz NOT NULL DEFAULT now(),
    total_beds integer DEFAULT 0,
    occupied_beds integer DEFAULT 0,
    available_beds integer DEFAULT 0,
    blocked_beds integer DEFAULT 0,
    cleaning_beds integer DEFAULT 0,
    reserved_beds integer DEFAULT 0,
    total_icu_beds integer DEFAULT 0,
    occupied_icu_beds integer DEFAULT 0,
    available_icu_beds integer DEFAULT 0,
    total_staff integer DEFAULT 0,
    available_staff integer DEFAULT 0,
    on_duty_staff integer DEFAULT 0,
    staff_utilization_pct numeric(5,2) DEFAULT 0,
    total_ot_rooms integer DEFAULT 0,
    available_ot_rooms integer DEFAULT 0,
    occupied_ot_rooms integer DEFAULT 0,
    ot_utilization_pct numeric(5,2) DEFAULT 0,
    total_diagnostic_devices integer DEFAULT 0,
    available_diagnostic_devices integer DEFAULT 0,
    diagnostic_queue_length integer DEFAULT 0,
    er_waiting integer DEFAULT 0,
    er_capacity integer DEFAULT 0,
    er_demand_score numeric(5,2) DEFAULT 0,
    overall_pressure_score numeric(5,2) DEFAULT 0,
    icu_pressure_score numeric(5,2) DEFAULT 0,
    bed_pressure_score numeric(5,2) DEFAULT 0,
    staff_pressure_score numeric(5,2) DEFAULT 0,
    er_pressure_score numeric(5,2) DEFAULT 0,
    is_current boolean NOT NULL DEFAULT true,
    CONSTRAINT hospital_state_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS hospital_state_current_idx ON hospilot.hospital_state(is_current, branch_id);
CREATE INDEX IF NOT EXISTS hospital_state_ts_idx ON hospilot.hospital_state(snapshot_at DESC);

CREATE TABLE IF NOT EXISTS hospilot.predictions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    prediction_type text NOT NULL,
    resource_type text,
    resource_id text,
    prediction_time timestamptz NOT NULL DEFAULT now(),
    forecast_start timestamptz NOT NULL,
    forecast_end timestamptz NOT NULL,
    predicted_value numeric,
    lower_bound numeric,
    upper_bound numeric,
    confidence numeric(4,3) DEFAULT 0.8,
    model_name text DEFAULT 'baseline_statistical',
    model_version text DEFAULT '1.0',
    is_synthetic boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT predictions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.prediction_factors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    prediction_id uuid NOT NULL REFERENCES hospilot.predictions(id) ON DELETE CASCADE,
    factor_name text NOT NULL,
    factor_value numeric,
    factor_weight numeric(4,3),
    CONSTRAINT prediction_factors_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS predictions_type_idx ON hospilot.predictions(prediction_type);
CREATE INDEX IF NOT EXISTS predictions_ts_idx ON hospilot.predictions(forecast_start DESC);

CREATE TABLE IF NOT EXISTS hospilot.bottlenecks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bottleneck_type text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    severity text NOT NULL DEFAULT 'moderate',
    detected_at timestamptz NOT NULL DEFAULT now(),
    current_value numeric,
    threshold_value numeric,
    predicted_time timestamptz,
    predicted_value numeric,
    confidence numeric(4,3) DEFAULT 0.8,
    status text NOT NULL DEFAULT 'active',
    resolved_at timestamptz,
    acknowledged_by text,
    CONSTRAINT bottlenecks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.bottleneck_dependencies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bottleneck_id uuid NOT NULL REFERENCES hospilot.bottlenecks(id) ON DELETE CASCADE,
    depends_on_bottleneck_id uuid REFERENCES hospilot.bottlenecks(id) ON DELETE SET NULL,
    dependency_type text,
    CONSTRAINT bottleneck_dependencies_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS bottlenecks_status_idx ON hospilot.bottlenecks(status);
CREATE INDEX IF NOT EXISTS bottlenecks_severity_idx ON hospilot.bottlenecks(severity);

CREATE TABLE IF NOT EXISTS hospilot.optimization_runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_type text NOT NULL,
    triggered_by text,
    trigger_id uuid,
    solver text DEFAULT 'cp_sat',
    solver_version text DEFAULT '1.0',
    status text NOT NULL DEFAULT 'pending',
    runtime_ms integer,
    objective_value numeric,
    is_feasible boolean,
    constraint_violations jsonb DEFAULT '[]',
    input_snapshot jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT optimization_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.optimization_constraints (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES hospilot.optimization_runs(id) ON DELETE CASCADE,
    constraint_name text NOT NULL,
    constraint_type text DEFAULT 'hard',
    constraint_value jsonb,
    is_satisfied boolean,
    violation_reason text,
    CONSTRAINT optimization_constraints_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.optimization_candidates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES hospilot.optimization_runs(id) ON DELETE CASCADE,
    candidate_rank integer DEFAULT 1,
    is_selected boolean NOT NULL DEFAULT false,
    plan_summary text,
    expected_impact jsonb DEFAULT '{}',
    rejection_reason text,
    plan_actions jsonb DEFAULT '[]',
    CONSTRAINT optimization_candidates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.recommendations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recommendation_number serial,
    rec_type text NOT NULL,
    priority text NOT NULL DEFAULT 'medium',
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    agent_id text,
    optimization_run_id uuid REFERENCES hospilot.optimization_runs(id) ON DELETE SET NULL,
    bottleneck_id uuid REFERENCES hospilot.bottlenecks(id) ON DELETE SET NULL,
    title text NOT NULL,
    summary text NOT NULL,
    reason text NOT NULL,
    expected_impact jsonb DEFAULT '{}',
    confidence numeric(4,3) DEFAULT 0.8,
    requires_approval boolean NOT NULL DEFAULT true,
    why_explanation text,
    constraints_satisfied jsonb DEFAULT '[]',
    alternatives_considered jsonb DEFAULT '[]',
    alternatives_rejected jsonb DEFAULT '[]',
    data_freshness_seconds integer,
    counterfactual_scenario jsonb DEFAULT '{}',
    CONSTRAINT recommendations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.recommendation_actions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES hospilot.recommendations(id) ON DELETE CASCADE,
    action_order integer NOT NULL DEFAULT 1,
    action_type text NOT NULL,
    target_resource_type text,
    target_resource_id text,
    action_description text NOT NULL,
    parameters jsonb DEFAULT '{}',
    status text NOT NULL DEFAULT 'pending',
    CONSTRAINT recommendation_actions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS recommendations_status_idx ON hospilot.recommendations(status);
CREATE INDEX IF NOT EXISTS recommendations_priority_idx ON hospilot.recommendations(priority);

CREATE TABLE IF NOT EXISTS hospilot.approval_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES hospilot.recommendations(id) ON DELETE CASCADE,
    requested_by text DEFAULT 'system',
    assigned_to text,
    status text NOT NULL DEFAULT 'pending',
    requested_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    expires_at timestamptz,
    decision text,
    decision_reason text,
    CONSTRAINT approval_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.approval_modifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    approval_request_id uuid NOT NULL REFERENCES hospilot.approval_requests(id) ON DELETE CASCADE,
    modification_type text NOT NULL,
    original_value jsonb,
    modified_value jsonb,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT approval_modifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.execution_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recommendation_id uuid REFERENCES hospilot.recommendations(id) ON DELETE SET NULL,
    approval_request_id uuid REFERENCES hospilot.approval_requests(id) ON DELETE SET NULL,
    action_id uuid REFERENCES hospilot.recommendation_actions(id) ON DELETE SET NULL,
    execution_status text NOT NULL DEFAULT 'pending',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    verified_at timestamptz,
    executor text DEFAULT 'system',
    component text,
    result jsonb DEFAULT '{}',
    error_message text,
    CONSTRAINT execution_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.recommendation_outcomes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES hospilot.recommendations(id) ON DELETE CASCADE,
    execution_log_id uuid REFERENCES hospilot.execution_log(id) ON DELETE SET NULL,
    measurement_at timestamptz NOT NULL DEFAULT now(),
    expected_impact jsonb DEFAULT '{}',
    actual_impact jsonb DEFAULT '{}',
    wait_time_before_seconds integer,
    wait_time_after_seconds integer,
    utilization_before_pct numeric(5,2),
    utilization_after_pct numeric(5,2),
    er_delay_before_seconds integer,
    er_delay_after_seconds integer,
    outcome_status text DEFAULT 'unknown',
    notes text,
    CONSTRAINT recommendation_outcomes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.audit_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    event_timestamp timestamptz NOT NULL DEFAULT now(),
    actor_type text NOT NULL,
    actor_id text,
    agent_id text,
    event_type text NOT NULL,
    resource_type text,
    resource_id text,
    action text NOT NULL,
    decision text,
    before_state jsonb,
    after_state jsonb,
    reason text,
    correlation_id text,
    session_id text,
    is_sensitive boolean DEFAULT false,
    CONSTRAINT audit_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON hospilot.audit_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_events_correlation_idx ON hospilot.audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS audit_events_resource_idx ON hospilot.audit_events(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS hospilot.simulation_scenarios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    scenario_name text NOT NULL,
    scenario_type text NOT NULL,
    description text,
    parameters jsonb DEFAULT '{}',
    time_multiplier integer DEFAULT 1,
    duration_minutes integer DEFAULT 60,
    is_baseline boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulation_scenarios_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.simulation_runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    scenario_id uuid NOT NULL REFERENCES hospilot.simulation_scenarios(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    started_at timestamptz,
    completed_at timestamptz,
    seed integer,
    with_curaflow boolean NOT NULL DEFAULT true,
    CONSTRAINT simulation_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.simulation_results (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES hospilot.simulation_runs(id) ON DELETE CASCADE,
    metric_name text NOT NULL,
    metric_value numeric,
    metric_unit text,
    time_offset_minutes integer DEFAULT 0,
    CONSTRAINT simulation_results_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.agent_runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agent_id text NOT NULL,
    workflow_id text,
    session_id text,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    status text NOT NULL DEFAULT 'running',
    model_name text,
    model_version text,
    latency_ms integer,
    confidence numeric(4,3),
    error_message text,
    CONSTRAINT agent_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.agent_decisions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES hospilot.agent_runs(id) ON DELETE CASCADE,
    decision_type text NOT NULL,
    decision_value text,
    reason text,
    confidence numeric(4,3),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_decisions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.data_sources (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    source_name text NOT NULL UNIQUE,
    source_type text NOT NULL,
    display_label text,
    status text NOT NULL DEFAULT 'connected',
    last_event_at timestamptz,
    last_checked_at timestamptz DEFAULT now(),
    latency_ms integer,
    error_count integer DEFAULT 0,
    consecutive_failures integer DEFAULT 0,
    config jsonb DEFAULT '{}',
    CONSTRAINT data_sources_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.data_quality_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES hospilot.data_sources(id) ON DELETE SET NULL,
    source_name text,
    event_type text NOT NULL,
    severity text DEFAULT 'warning',
    description text,
    affected_resource_type text,
    affected_count integer DEFAULT 1,
    detected_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CONSTRAINT data_quality_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hospilot.synthetic_patients (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_token text NOT NULL UNIQUE,
    age_group text,
    acuity_level text DEFAULT 'moderate',
    condition_category text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT synthetic_patients_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS staff_status_idx ON hospilot.staff(status, department_id);
CREATE INDEX IF NOT EXISTS staff_assignments_active_idx ON hospilot.staff_assignments(staff_id, status);
CREATE INDEX IF NOT EXISTS ot_schedule_status_idx ON hospilot.ot_schedule(status, scheduled_start);
CREATE INDEX IF NOT EXISTS diagnostic_queue_status_idx ON hospilot.diagnostic_queue(status, priority);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON hospilot.agent_runs(agent_id, status);
