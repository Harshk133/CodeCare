// SwasthyaAI Curated Medical Knowledge Base

export interface DiseaseKnowledge {
  id: string;
  name: string;
  category: "infection" | "respiratory" | "viral" | "bacterial" | "general";
  symptoms: string[];
  whoGuidelines: string[];
  allopathyTreatment: {
    description: string;
    management: string[];
    medications: string[];
    warnings: string[];
  };
  homeopathyTreatment: {
    description: string;
    remedies: { name: string; indication: string }[];
    warnings: string[];
  };
  prevention: string[];
  emergencyTriggers: string[];
}

export interface EmergencyProtocol {
  id: string;
  symptomPattern: string;
  riskLevel: "emergency";
  immediateActions: string[];
  emergencyServices: string;
}

export interface MockOutbreak {
  id: string;
  disease: string;
  state: string;
  district: string;
  severity: "low" | "medium" | "high";
  casesCount: number;
  advisory: string;
  date: string;
}

export const DISEASES_KNOWLEDGE: DiseaseKnowledge[] = [
  {
    id: "dengue",
    name: "Dengue Fever",
    category: "viral",
    symptoms: [
      "High fever (up to 104°F or 40°C)",
      "Severe headache",
      "Pain behind the eyes",
      "Severe joint and muscle pain (known as 'break-bone fever')",
      "Fatigue and nausea",
      "Skin rash appearing 2-5 days after onset of fever",
      "Mild bleeding from nose or gums",
    ],
    whoGuidelines: [
      "Monitor blood platelet counts daily.",
      "Check hematocrit level for signs of plasma leakage.",
      "Strict vector control: eliminate standing water where Aedes mosquitoes breed.",
      "Never prescribe Aspirin or Ibuprofen due to bleeding risk; use Paracetamol only.",
    ],
    allopathyTreatment: {
      description:
        "Allopathic treatment focuses on symptom relief, maintaining fluid levels, and monitoring for warning signs of severe dengue.",
      management: [
        "Oral rehydration therapy (ORS) to prevent dehydration from high fever.",
        "Complete physical rest.",
        "Daily monitoring of platelet count and hematocrit.",
        "Intravenous fluid therapy under medical supervision in case of plasma leakage.",
      ],
      medications: [
        "Paracetamol (Acetaminophen) for fever and pain relief.",
        "Avoid NSAIDs (Aspirin, Ibuprofen, Naproxen) as they increase hemorrhage risks.",
      ],
      warnings: [
        "Look out for warning signs: severe abdominal pain, persistent vomiting, mucosal bleeding, fluid accumulation, lethargy.",
      ],
    },
    homeopathyTreatment: {
      description:
        "Homeopathy offers supportive treatment for symptom relief and boosting recovery, especially for bone pain and fever management.",
      remedies: [
        {
          name: "Eupatorium Perfoliatum",
          indication:
            "Highly recommended for intense bone and joint pains ('break-bone' sensation) accompanied by soreness and high fever.",
        },
        {
          name: "Gelsemium Sempervirens",
          indication:
            "Useful when there is deep fatigue, drowsiness, muscle weakness, and absence of thirst despite high fever.",
        },
        {
          name: "Carica Papaya Q (Mother Tincture)",
          indication:
            "Often used in traditional Indian homeopathy as a supportive remedy to improve platelet count.",
        },
      ],
      warnings: [
        "Homeopathic remedies are supportive only. Never delay checking platelet counts or seeking emergency care if severe symptoms occur.",
      ],
    },
    prevention: [
      "Use mosquito nets while sleeping.",
      "Apply insect repellents containing DEET, Picaridin, or IR3535.",
      "Wear long-sleeved shirts and full pants.",
      "Drain and clean domestic water tanks, flower pots, and coolers weekly.",
    ],
    emergencyTriggers: [
      "Severe abdominal pain",
      "Persistent vomiting (more than 3 times in 24 hours)",
      "Bleeding from gums or nose",
      "Blood in vomit or stools",
      "Severe fatigue, restlessness, or confusion",
      "Rapid breathing",
    ],
  },
  {
    id: "malaria",
    name: "Malaria",
    category: "infection",
    symptoms: [
      "Shaking chills",
      "High fever that spikes every 24-48 hours",
      "Profuse sweating as body temperature drops",
      "Headache, vomiting, and diarrhea",
      "Anemia and muscle fatigue",
      "Splenomegaly (enlarged spleen)",
    ],
    whoGuidelines: [
      "Early diagnosis is critical (RDT or microscopic slide tests).",
      "Artemisinin-based combination therapy (ACT) is the recommended first-line treatment for Plasmodium falciparum.",
      "Insecticide-treated nets (ITNs) are the primary preventive tool.",
    ],
    allopathyTreatment: {
      description:
        "Allopathic treatment consists of targeted antimalarial drugs to eradicate the parasite from the bloodstream.",
      management: [
        "Immediate diagnostic confirmation using blood smears or Rapid Diagnostic Tests (RDT).",
        "Administration of antimalarial drug regimens based on regional resistance patterns.",
        "Symptomatic management of fever and dehydration.",
      ],
      medications: [
        "Artemether-lumefantrine or Artesunate-sulfadoxine-pyrimethamine (ACTs).",
        "Chloroquine (only for chloroquine-sensitive Plasmodium vivax).",
        "Primaquine (to prevent relapse of dormant liver stages).",
      ],
      warnings: [
        "Monitor for severe malaria signs: extreme weakness, jaundice, black urine, convulsions, breathing difficulty.",
      ],
    },
    homeopathyTreatment: {
      description:
        "Homeopathic treatment is used as an adjunct during recovery to reduce debility and fever recurrence cycle.",
      remedies: [
        {
          name: "Arsenicum Album",
          indication:
            "Indicated when the patient experiences severe chilliness, high anxiety, restlessness, intense thirst for small sips of warm water, and spikes in fever.",
        },
        {
          name: "China Officinalis (Cinchona)",
          indication:
            "Highly useful for extreme weakness, dehydration, and exhaustion following debilitating sweat and periodic fevers.",
        },
        {
          name: "Nux Vomica",
          indication:
            "Used during the chill stage when the patient feels extremely cold, wants to stay covered completely, and experiences gastric irritability.",
        },
      ],
      warnings: [
        "Malaria is a life-threatening infection. Homeopathic remedies must only be used as supportive care alongside verified antimalarial medication.",
      ],
    },
    prevention: [
      "Sleep under insecticide-treated bed nets.",
      "Spray indoor walls with residual insecticides (IRS).",
      "Clear stagnant water pools and drainage trenches.",
      "Use mosquito repellent vaporizers in homes.",
    ],
    emergencyTriggers: [
      "Inability to swallow or drink",
      "Repeated convulsions or seizures",
      "Loss of consciousness or severe lethargy",
      "Yellow eyes (jaundice) or dark-coloured urine",
      "Difficulty breathing or short gasps",
    ],
  },
  {
    id: "covid",
    name: "COVID-19",
    category: "respiratory",
    symptoms: [
      "Fever and chills",
      "Dry cough and sore throat",
      "Loss of taste or smell (anosmia)",
      "Shortness of breath or breathing difficulty",
      "Fatigue, body aches, and headaches",
      "Congestion or runny nose",
      "Diarrhea or vomiting in some cases",
    ],
    whoGuidelines: [
      "Maintain isolation to prevent transmission.",
      "Monitor oxygen saturation levels (SpO2) using a pulse oximeter.",
      "Seek emergency care if oxygen levels drop below 94%.",
      "Avoid indiscriminate use of antibiotics, corticosteroids, or anticoagulants.",
    ],
    allopathyTreatment: {
      description:
        "Allopathic treatment consists of isolation, monitoring, antiviral therapies for high-risk patients, and oxygen support for severe cases.",
      management: [
        "Isolation in a well-ventilated room.",
        "Hydration and fever control.",
        "Continuous monitoring of oxygen levels (SpO2) and temperature.",
        "Proning techniques to improve lung oxygenation.",
      ],
      medications: [
        "Antivirals (Paxlovid/Nirmatrelvir-Ritonavir or Remdesivir) for eligible high-risk patients.",
        "Paracetamol for fever and body ache control.",
        "Inhaled corticosteroids under direct doctor prescription if cough persists.",
      ],
      warnings: [
        "Immediate emergency care is required if SpO2 drops below 92%, or if chest pressure is constant.",
      ],
    },
    homeopathyTreatment: {
      description:
        "Homeopathic care targets respiratory symptoms, throat discomfort, and deep post-viral fatigue.",
      remedies: [
        {
          name: "Bryonia Alba",
          indication:
            "Best suited for dry, painful cough, dry mouth, extreme thirst, and when any movement aggravates chest discomfort.",
        },
        {
          name: "Arsenicum Album",
          indication:
            "Recommended by traditional advisory boards for general immune support, anxiety, dry cough, and marked weakness.",
        },
        {
          name: "Gelsemium",
          indication:
            "Specifically used for headache, heavy eyelids, post-viral sluggishness, and fatigue following respiratory infections.",
        },
      ],
      warnings: [
        "COVID-19 can cause silent hypoxia. Homeopathy must never replace oximeter monitoring. Seek hospital admission if oxygen saturation drops.",
      ],
    },
    prevention: [
      "Get vaccinated and take booster doses.",
      "Wear fitted masks (N95 or double mask) in crowded spaces.",
      "Maintain physical distance (at least 6 feet).",
      "Wash hands frequently with soap or alcohol sanitizers.",
      "Ensure rooms are well-ventilated.",
    ],
    emergencyTriggers: [
      "Oxygen saturation levels (SpO2) dropping below 94%",
      "Difficulty breathing or persistent shortness of breath",
      "Persistent pain or pressure in the chest",
      "New confusion or inability to wake or stay awake",
      "Pale, gray, or blue skin, lips, or nail beds",
    ],
  },
  {
    id: "tuberculosis",
    name: "Tuberculosis (TB)",
    category: "bacterial",
    symptoms: [
      "Persistent cough lasting 3 weeks or more",
      "Coughing up blood or sputum",
      "Unexplained weight loss and loss of appetite",
      "Night sweats and low-grade fever (often worsening in the evening)",
      "Fatigue and general weakness",
      "Chest pain",
    ],
    whoGuidelines: [
      "Implement DOTS (Directly Observed Treatment, Short-course) to prevent drug resistance.",
      "Ensure molecular diagnostic testing (GeneXpert) for early drug-resistance detection.",
      "Screen close contacts of active pulmonary TB cases.",
      "Complete the full 6-month or 9-month treatment course without interruption.",
    ],
    allopathyTreatment: {
      description:
        "Allopathic treatment utilizes a combination of highly potent antibiotics taken daily for at least 6 months (RNTCP/DOTS guidelines).",
      management: [
        "Sputum testing and chest X-rays for confirmation.",
        "DOTS therapy to ensure patient compliance.",
        "Nutritional support (such as the Nikshay Poshan Yojana in India).",
        "Periodic liver function tests to monitor drug safety.",
      ],
      medications: [
        "First-line drugs: Isoniazid (H), Rifampicin (R), Pyrazinamide (Z), and Ethambutol (E) for the intensive phase.",
        "Continuation phase drugs: Isoniazid and Rifampicin.",
      ],
      warnings: [
        "Stopping treatment early leads to Multi-Drug Resistant TB (MDR-TB), which is extremely difficult to cure.",
      ],
    },
    homeopathyTreatment: {
      description:
        "Homeopathic remedies act as supportive tonics to enhance appetite, relieve cough, and reduce antibiotic side effects.",
      remedies: [
        {
          name: "Phosphorus",
          indication:
            "Indicated for dry cough, tickling chest sensation, hoarseness, evening fever spikes, and minor blood streaks in phlegm.",
        },
        {
          name: "Bacillinum",
          indication:
            "A classical nosode used by experienced practitioners as intercurrent supportive therapy for chronic cough and night sweats.",
        },
        {
          name: "Arsenicum Iodatum",
          indication:
            "Used to treat dry hacky cough, profound weakness, night sweats, and rapid emaciation/weight loss.",
        },
      ],
      warnings: [
        "TB is a severe bacterial infection. Homeopathy MUST NOT be used as a substitute for DOTS/allopathic multi-drug therapy. Stopping antibiotics will cause drug-resistant TB.",
      ],
    },
    prevention: [
      "BCG vaccination at birth.",
      "Ensure good ventilation in living spaces.",
      "Use masks and practice respiratory hygiene (covering mouth when coughing).",
      "Avoid close contact with active untreated TB patients.",
    ],
    emergencyTriggers: [
      "Coughing up large amounts of bright red blood (hemoptysis)",
      "Sudden, severe shortness of breath or chest pain",
      "Severe abdominal pain or jaundice from medication side effects",
      "Inability to tolerate medications due to constant vomiting",
    ],
  },
];

export const EMERGENCY_PROTOCOLS: EmergencyProtocol[] = [
  {
    id: "chest-pain",
    symptomPattern: "radiating chest pain, pressure, arm numbness",
    riskLevel: "emergency",
    immediateActions: [
      "Sit down and remain completely calm. Do NOT exert yourself.",
      "If prescribed nitroglycerin, take it immediately.",
      "Chew an adult aspirin (325mg) if available and not allergic.",
      "Call emergency services (108 in India) immediately.",
    ],
    emergencyServices: "Call 108 for Cardiac Emergency Response",
  },
  {
    id: "stroke",
    symptomPattern: "facial drooping, arm weakness, slurred speech (FAST)",
    riskLevel: "emergency",
    immediateActions: [
      "FAST Test: Face drooping? Arm weakness? Speech difficulty? Time to call 108.",
      "Note the exact time symptoms started. This is critical for clot-busting therapy.",
      "Do NOT give the person food, drink, or aspirin (it may be a bleeding stroke).",
      "Keep them lying on their side if they feel nauseous.",
    ],
    emergencyServices: "Call 108 for Stroke Treatment Center",
  },
  {
    id: "breathing",
    symptomPattern: "gasping, severe dyspnea, blue lips",
    riskLevel: "emergency",
    immediateActions: [
      "Sit the person upright to help open their airways.",
      "Loosen tight clothing around their neck.",
      "Assist them with their emergency rescue inhaler (e.g. Salbutamol) if available.",
      "Check oxygen levels with an oximeter.",
      "Administer emergency oxygen if available and call for an ambulance.",
    ],
    emergencyServices: "Call 108 for Respiratory Emergency Care",
  },
];

export const MOCK_OUTBREAKS: MockOutbreak[] = [
  {
    id: "outbreak-1",
    disease: "Dengue Fever",
    state: "Maharashtra",
    district: "Pune",
    severity: "high",
    casesCount: 420,
    advisory:
      "Municipal corporation has initiated fogging drives. Public advised to drain coolers and wear full clothing to avoid daytime mosquito bites.",
    date: "2026-06-01",
  },
  {
    id: "outbreak-2",
    disease: "Malaria",
    state: "Odisha",
    district: "Koraput",
    severity: "medium",
    casesCount: 180,
    advisory:
      "Distribution of insecticide-treated bed nets is ongoing. Local healthcare workers are running microscopic tests in Primary Health Centers.",
    date: "2026-06-03",
  },
  {
    id: "outbreak-3",
    disease: "COVID-19 (Subvariant)",
    state: "Kerala",
    district: "Ernakulam",
    severity: "medium",
    casesCount: 290,
    advisory:
      "Wear masks in hospitals and crowded public transit. Monitor oxygen levels if fever persists beyond 3 days.",
    date: "2026-06-04",
  },
  {
    id: "outbreak-4",
    disease: "Cholera",
    state: "West Bengal",
    district: "Kolkata",
    severity: "high",
    casesCount: 85,
    advisory:
      "Avoid drinking unfiltered tap water. Drink boiled water or chlorinate drinking supplies. Visit nearest clinic immediately if watery diarrhea develops.",
    date: "2026-06-05",
  },
];
