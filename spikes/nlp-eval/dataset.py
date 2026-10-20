"""
Dataset sintetis untuk evaluasi engine NLP Bilingual (ID/EN)
Semua data bersifat sintetis dan bebas dari PII nyata.
"""

DATASETS = [
    {
        "id": "ID_BACKEND_01",
        "lang": "id",
        "role": "Senior Backend Developer",
        "cv_text": """
        Budi Santoso - Backend Developer
        Email: budi.sample@example.com | Telepon: 08120000000
        
        RINGKASAN
        Backend engineer berpengalaman 4 tahun membangun REST API dengan Python FastAPI, PostgreSQL, dan Redis. Terbiasa dengan Docker, Git, microservices, dan automated testing.
        
        PENGALAMAN KERJA
        PT Solusi Teknologi - Senior Backend Developer (2023 - Sekarang)
        - Membangun RESTful API dengan FastAPI dan SQLAlchemy.
        - Optimasi database PostgreSQL dan caching menggunakan Redis.
        - Menulis unit testing menggunakan pytest dengan coverage 85%.
        - Mengelola container Docker dan CI/CD pipeline dengan Git.
        
        KANTOR SEBELUMNYA
        PT Data Prima - Junior Developer (2021 - 2022)
        - Memelihara modul backend berbasis Python dan MySQL.
        - Menulis dokumentasi teknis dan integrasi pihak ketiga.
        
        PENDIDIKAN
        S1 Ilmu Komputer - Universitas Indonesia (2017 - 2021)
        
        KEAHLIAN
        Python, FastAPI, Django, PostgreSQL, MySQL, Redis, Docker, Git, REST API, Microservices, Pytest, Linux
        """,
        "job_desc": """
        Kami mencari Senior Backend Developer untuk bergabung dengan tim kami.
        Kualifikasi:
        - Pengalaman minimal 3 tahun dengan Python (FastAPI atau Django).
        - Mahir dalam perancangan database relasional PostgreSQL atau MySQL.
        - Pengalaman dengan Redis, Docker, dan Git.
        - Memahami arsitektur REST API dan microservices.
        - Memiliki kebiasaan menulis automated testing (pytest).
        - Pendidikan minimal S1 Ilmu Komputer atau bidang terkait.
        """,
        "expected_matched_skills": [
            "python", "fastapi", "django", "postgresql", "mysql", "redis", "docker", "git", "rest api", "microservices", "pytest"
        ],
        "expected_missing_skills": []
    },
    {
        "id": "ID_UIUX_02",
        "lang": "id",
        "role": "Product Designer / UI/UX",
        "cv_text": """
        Siti Rahma - UI/UX Designer
        Email: siti.design@example.com
        
        RINGKASAN
        Desainer produk dengan spesialisasi user research, wireframing, prototyping di Figma, dan design system.
        
        PENGALAMAN
        PT Kreasi Digital - UI/UX Designer (2022 - Sekarang)
        - Merancang wireframe dan high-fidelity prototype di Figma.
        - Melakukan usability testing dan wawancara pengguna (user interview).
        - Membangun dan memelihara design system untuk aplikasi mobile dan web.
        
        KEAHLIAN
        Figma, User Research, Wireframing, Prototyping, Usability Testing, Design System, Adobe XD, HTML, CSS
        """,
        "job_desc": """
        Dibutuhkan UI/UX Designer berpengalaman.
        Kebutuhan:
        - Menguasai Figma dan Adobe XD untuk prototyping dan wireframing.
        - Pengalaman dalam user research, usability testing, dan user interview.
        - Mampu membuat dan mengelola design system.
        - Pemahaman dasar HTML dan CSS merupakan nilai tambah.
        - Pengalaman dengan Flutter atau React Native.
        """,
        "expected_matched_skills": [
            "figma", "adobe xd", "prototyping", "wireframing", "user research", "usability testing", "design system", "html", "css"
        ],
        "expected_missing_skills": [
            "flutter", "react native"
        ]
    },
    {
        "id": "EN_FRONTEND_03",
        "lang": "en",
        "role": "Senior Frontend Engineer",
        "cv_text": """
        John Doe - Frontend Engineer
        San Francisco, CA | john.doe@example.com
        
        SUMMARY
        Frontend Engineer with 5 years of experience building scalable single-page applications using React, TypeScript, Tailwind CSS, and Next.js.
        
        EXPERIENCE
        Acme Corp - Senior Frontend Engineer (2022 - Present)
        - Architected web applications using React, TypeScript, and Next.js.
        - Integrated state management with Zustand and TanStack Query.
        - Implemented accessible UI components following WCAG AA standards with Tailwind CSS and Radix UI.
        - Automated testing with Vitest and Playwright.
        
        SKILLS
        React, TypeScript, JavaScript, Next.js, Tailwind CSS, HTML5, CSS3, Vite, Vitest, Playwright, Git, REST API, GraphQL
        """,
        "job_desc": """
        Looking for a Senior Frontend Engineer.
        Requirements:
        - 4+ years building frontend applications with React and TypeScript.
        - Experience with modern CSS frameworks like Tailwind CSS.
        - Strong background in automated end-to-end testing with Playwright or Cypress.
        - Experience with GraphQL and REST APIs.
        - Knowledge of accessibility standards (WCAG).
        - Experience with AWS Cloud deployment and Kubernetes is a plus.
        """,
        "expected_matched_skills": [
            "react", "typescript", "tailwind css", "playwright", "graphql", "rest api"
        ],
        "expected_missing_skills": [
            "aws", "kubernetes"
        ]
    },
    {
        "id": "CROSS_LANG_04",
        "lang": "cross_id_cv_en_job",
        "role": "Data Analyst (ID CV vs EN Job)",
        "cv_text": """
        Andi Pratama - Data Analyst
        Jakarta | andi.data@example.com
        
        RINGKASAN
        Analis data dengan pengalaman 2 tahun dalam analisis data bisnis, pembuatan dashboard visualisasi menggunakan Tableau dan Power BI, serta query data dengan SQL dan Python.
        
        PENGALAMAN KERJA
        PT Wawasan Data - Junior Data Analyst (2022 - 2024)
        - Membuat laporan berkala dan dashboard interaktif dengan Power BI dan Tableau.
        - Melakukan query kompleks dan data cleansing menggunakan SQL (PostgreSQL).
        - Menggunakan Python (Pandas, Matplotlib) untuk analisis tren penjualan.
        
        KEAHLIAN
        SQL, Python, Pandas, Tableau, Power BI, Excel, Data Visualization, Data Cleansing, Statistics
        """,
        "job_desc": """
        Job Opening: Data Analyst
        Key Responsibilities & Skills:
        - Proficiency in SQL and relational databases for querying data.
        - Hands-on experience with Business Intelligence tools such as Power BI or Tableau.
        - Scripting skills in Python for data manipulation (Pandas).
        - Advanced Excel skills.
        - Strong analytical thinking and communication skills.
        - Experience with BigQuery, Snowflake, and dbt is preferred.
        """,
        "expected_matched_skills": [
            "sql", "power bi", "tableau", "python", "pandas", "excel"
        ],
        "expected_missing_skills": [
            "bigquery", "snowflake", "dbt"
        ]
    }
]
