--
-- PostgreSQL database dump
--

\restrict qIN8eF2jLQ499rB2aNECU9sei9QsAoPwG7kT9P5JTZE7GA0yy6KgeW8jvEPsp84

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Debian 17.6-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: endpoints; Type: TABLE DATA; Schema: neon_control_plane; Owner: postgres
--

COPY neon_control_plane.endpoints (endpoint_id, allowed_ips) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, email, "emailVerified", image, role, "createdAt", "updatedAt", banned, "banReason", "banExpires", password, default_organization_id, last_used_organization_id, last_org_access_at, active_organization_id, updated_at) FROM stdin;
0198d836-58b6-7590-b715-8974f2033b0a	Test Member	test-member@widecorp.com	t	\N	user	2025-08-23 18:34:57.077+00	2025-08-23 18:34:57.077+00	\N	\N	\N	\N	01920000-1000-7000-8000-000000000001	72622cf0-b4c6-4f15-890f-e0b9f695fcdb	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198d872-3eda-781e-910f-e8d109fbb967	Gary Guest	guest@widecorp.com	t	\N	user	2025-08-23 19:40:22.618+00	2025-08-23 19:40:22.618+00	\N	\N	\N	\N	01920000-1000-7000-8000-000000000001	665049a7-dfed-4f01-8180-41202efaba3a	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198f65b-d657-7440-a635-5b59be41b835	New Test User	newuser@widecorp.com	f	\N	admin	2025-08-29 15:04:30.55+00	2025-08-29 15:05:04.291+00	f	\N	\N	\N	4dd6b20a-aa87-4e43-a52d-7c42856d725e	4dd6b20a-aa87-4e43-a52d-7c42856d725e	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
01992531-7bed-7ceb-bbb1-4a35f77d8ba5	Test User E2E	test.e2e.registration@example.com	f	\N	user	2025-09-07 17:20:24.044+00	2025-09-07 17:20:24.044+00	\N	\N	\N	\N	\N	\N	\N	\N	2025-09-07 19:02:37.342765+00
0199258f-5cb6-7998-b7db-d44c86f0149e	Newest Test User 1757271767298	newest.1757271767298@gmail.com	f	\N	user	2025-09-07 19:02:56.438+00	2025-09-07 19:02:56.438+00	\N	\N	\N	\N	0199258f-5dde-7dc0-bef9-4e11c293c8cd	0199258f-5ef3-7d3f-9436-f506791cad07	2025-09-07 19:02:57.019772+00	0199258f-5ef3-7d3f-9436-f506791cad07	2025-09-07 19:02:57.022+00
0199053c-c896-7c9d-bbc5-1da987af005d	Personal Test User	testpersonal@example.com	f	\N	user	2025-09-01 12:24:53.653+00	2025-09-01 12:24:53.653+00	\N	\N	\N	\N	\N	\N	\N	\N	2025-09-07 19:02:37.342765+00
01992556-5e1c-7c5e-aaf9-9493f425d57a	Trial Test User	trial.test.user@gmail.com	f	\N	user	2025-09-07 18:00:41.244+00	2025-09-07 18:00:41.244+00	\N	\N	\N	\N	01992556-60c6-7a48-a54f-5348ded91e7e	01992556-60c6-7a48-a54f-5348ded91e7e	2025-09-07 18:00:41.932175+00	\N	2025-09-07 19:02:37.342765+00
01992590-a15f-71af-a149-08f58d356bdb	E2E Test User Final	e2efinal.test@gmail.com	t	\N	user	2025-09-07 19:04:19.551+00	2025-09-07 19:04:19.551+00	\N	\N	\N	\N	01992590-a56f-760d-a90f-01f9750a7ab6	01992590-a6a2-7888-86e6-d4bf191ac1cf	2025-09-07 19:04:20.902106+00	01992590-a6a2-7888-86e6-d4bf191ac1cf	2025-09-07 19:04:20.904+00
0198aed6-cc0b-783b-b414-c5fb8a81f227	TechFlow Admin	admin@techflow.solutions	t	\N	user	2025-08-15 17:46:09.288+00	2025-08-17 12:41:50.512685+00	\N	\N	\N	$2b$12$UkgwO6dP5ESpW4LcTIneguT5qCkwGzl4vPEuLxlhJsym0cUL6Jfza	108b0ac2-487f-4951-b295-b1924288daad	0031029c-9915-4de2-9179-ffbb159057f1	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198d86e-2544-71f8-8188-026e43f726c6	Jim Member	member@widecorp.com	t	\N	user	2025-08-23 19:35:53.924+00	2025-08-23 19:35:53.924+00	\N	\N	\N	\N	01920000-1000-7000-8000-000000000001	bddd93de-7a65-444a-88e1-0ea0334d012a	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0199258e-2a3a-722e-88fe-e19dceafa723	E2E Test User 1757271685	e2etest.1757271685@gmail.com	f	\N	user	2025-09-07 19:01:37.977+00	2025-09-07 19:01:37.977+00	\N	\N	\N	\N	0199258e-2bcf-7ae6-bcf9-731159986320	0199258e-2d33-75db-9b3d-21d47aae6c2c	2025-09-07 19:01:38.74783+00	\N	2025-09-07 19:02:37.342765+00
0198b046-d931-7772-a1e8-b63c68c7f43d	Carol PM	pm1@widecorp.com	t	\N	user	2025-08-16 00:28:09.905+00	2025-08-17 12:55:09.824229+00	\N	\N	\N	$2b$12$ciyrZyDuwZ9ZAl4rENG.ZOpvabqyRgGxVPxoeO/gCBTq0N1n.qi6i	01920000-1000-7000-8000-000000000001	ef1f96f1-cfab-478b-96e1-159fcdc02bb7	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-e16b-7b46-a15e-baa49fd29990	David PM	pm2@widecorp.com	t	\N	user	2025-08-16 00:28:12.011+00	2025-08-17 12:55:10.18225+00	\N	\N	\N	$2b$12$68H96svCejJIiTnncWJO/.KGreKFVgVylSL7TAiBxwFx5KZoUB3/O	01920000-1000-7000-8000-000000000001	ec09e01f-1b70-44bd-85c1-79ee7bfb3cbe	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-e873-7739-bac2-10db9440486b	Eve Developer	dev1@widecorp.com	t	\N	user	2025-08-16 00:28:13.81+00	2025-08-17 12:55:10.606779+00	\N	\N	\N	$2b$12$mALd9lLsH5p5TzERnvAmSOgaG6GD/CzdPemEkd2UII8pODiPn7iKe	01920000-1000-7000-8000-000000000001	a5e17f31-827c-466d-a5f6-44480a0d9a26	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-f056-7735-a3aa-60e8a329dd23	Frank Developer	dev2@widecorp.com	t	\N	user	2025-08-16 00:28:15.829+00	2025-08-17 12:55:11.079074+00	\N	\N	\N	$2b$12$CKAeG/Wme8JtNsQaDnnBkuTY9a898Me3/fDsPJ7Ym9k8wCE8njn4O	01920000-1000-7000-8000-000000000001	caf9988b-d2ef-43de-82b7-580833bd1b84	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-f71e-7bec-a853-294d7cbcbda5	Grace Designer	designer@widecorp.com	t	\N	user	2025-08-16 00:28:17.565+00	2025-08-17 12:55:11.600933+00	\N	\N	\N	$2b$12$VdwNBJWrtU2GynBWVd3xjeYrvdkRQudkKntGOyH6PAhbkOLfXZ4FW	01920000-1000-7000-8000-000000000001	07635be6-a99b-4569-bf72-ceda2e450323	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-fe7a-7855-b4d8-4408253dc9c5	Henry Intern	intern@widecorp.com	t	\N	user	2025-08-16 00:28:19.45+00	2025-08-17 12:55:12.015002+00	\N	\N	\N	$2b$12$.e0lFAaKpiSYmrHFk9AgseXwDrGtPipiPBR78qwLBcX3gD87vknm.	01920000-1000-7000-8000-000000000001	92d66d2b-726b-45f4-949e-25c29a0f8642	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	Playwright Test User	test-playwright-1755347086@gmail.com	t	\N	admin	2025-08-16 12:24:47.367+00	2025-08-16 12:24:47.367+00	\N	\N	\N	\N	0a1eaf20-5386-43e8-ad36-73fafefeb500	24254bc5-5fdd-45f4-9694-f61a23a8562a	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b059-5419-7165-b2c3-937a66b94865	System Admin	admin@polytest.com	t	\N	user	2025-08-16 00:48:21.017+00	2025-08-16 00:48:21.017+00	\N	\N	\N	\N	01920000-2000-7000-8000-000000000002	eeb713e6-e94a-435e-a66a-41443d8658bf	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b059-5999-7f84-8217-0506a838e0da	Sales Manager	sales@polytest.com	t	\N	user	2025-08-16 00:48:22.425+00	2025-08-16 00:48:22.425+00	\N	\N	\N	\N	01920000-2000-7000-8000-000000000002	1715c778-0ecd-4a3f-af5c-838ab51bbf0b	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	Support Agent	support@polytest.com	t	\N	user	2025-08-16 00:48:23.998+00	2025-08-16 00:48:23.998+00	\N	\N	\N	\N	01920000-2000-7000-8000-000000000002	fdb6bff8-e11e-4a98-a5f8-4a8531386701	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b059-64c9-7c4f-87be-5b1a3704f1c3	Read Only User	readonly@polytest.com	t	\N	user	2025-08-16 00:48:25.289+00	2025-08-16 00:48:25.289+00	\N	\N	\N	\N	01920000-2000-7000-8000-000000000002	8b525929-c8f5-4056-b343-1f85f70e34d2	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198d86e-3ed0-7bf2-9317-674ef372c7db	Kate Viewer	viewer@widecorp.com	t	\N	user	2025-08-23 19:36:00.463+00	2025-08-23 19:36:00.463+00	\N	\N	\N	\N	01920000-1000-7000-8000-000000000001	75209771-bdad-4eda-96ab-fb14803668db	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-d127-769d-9bc2-8e5824b71b3a	Bob CTO	cto@widecorp.com	t	\N	admin	2025-08-16 00:28:07.847+00	2025-08-17 12:55:09.418718+00	\N	\N	\N	$2b$12$GDPdRpqlTyZolhv.m0jQIuRJgAPBYpKLVQnH2hP4F6Wh8aluRFOuC	01920000-1000-7000-8000-000000000001	81a82bbb-5544-4a9b-8215-5174887e224a	2025-09-01 11:54:50.100666+00	\N	2025-09-07 19:02:37.342765+00
0198b046-c453-72d9-b71a-092e1f75601a	Alice CEO	ceo@widecorp.com	t	\N	admin	2025-08-16 00:28:04.561+00	2025-08-17 12:55:09.020964+00	\N	\N	\N	$2b$12$RZX/uFINTrCFCSlAn33JDumVcEb2KdvsXwuB0flwHBwTo/lBx.2mC	01920000-2000-7000-8000-000000000002	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-06 18:29:00.5756+00	\N	2025-09-07 19:02:37.342765+00
0199258e-e3f0-74df-b56a-8841ec9bcd35	Fresh Test User 1757271732549	freshuser.1757271732549@gmail.com	f	\N	user	2025-09-07 19:02:25.52+00	2025-09-07 19:02:25.52+00	\N	\N	\N	\N	0199258e-e50a-7f60-8aad-64ca53ac3cf8	0199258e-e6a0-7658-9e9b-809e686b04bc	2025-09-07 19:02:26.217183+00	\N	2025-09-07 19:02:37.342765+00
\.


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
0198d836-5c3e-7f6a-9566-93c327d87859	0198d836-58b6-7590-b715-8974f2033b0a	credential	0198d836-58b6-7590-b715-8974f2033b0a	\N	\N	\N	\N	\N	\N	ef1c6982b8bd05731241f8b86bf0ece6:bdf88fd23b7f3e995c2e7ec35821a98b266423cf73df7cceeb4a06558c6ef86ca2171a4bbcd5f02ae08fd0f4a6f33bafa3489a451f363084c6760e4800c7f9f6	2025-08-23 14:34:57.981	2025-08-23 14:34:57.981
0198f65b-dcb8-7ae4-8d60-2cc340b6566d	0198f65b-d657-7440-a635-5b59be41b835	credential	0198f65b-d657-7440-a635-5b59be41b835	\N	\N	\N	\N	\N	\N	53f9a70d5ddba4aab4253ba0fd2db003:48d0d7c24f66e6e946d01567d5551cebb7b4e930616a952c5b4f5b38c32b28223544c715fb315dae99519ff066e164c6fd7a6230b1b50a3df9aa54e2a2e8e38a	2025-08-29 15:04:32.183	2025-08-29 15:04:32.183
01992556-60d3-724a-ae65-2bc59a820b0e	01992556-5e1c-7c5e-aaf9-9493f425d57a	credential	01992556-5e1c-7c5e-aaf9-9493f425d57a	\N	\N	\N	\N	\N	\N	b3a56e0ed2ab90fa51c63f11f7f77ab8:8c621b49e42e1780cdaef4447177b2710fc37e219a039e2232ce6e28af227671bb62191aa98840526e65bf8050b5addd8f5405b46420e973478c0202d15f2606	2025-09-07 18:00:41.939	2025-09-07 18:00:41.939
0198d86e-2997-7f91-8872-b0bc741552ec	0198d86e-2544-71f8-8188-026e43f726c6	credential	0198d86e-2544-71f8-8188-026e43f726c6	\N	\N	\N	\N	\N	\N	fd10f0dac2a4e74279378191d3adcd7f:ae0b54388f0be124bae90c74ec8374e46f3d088aba8288a2213c1db7f57fab099ea5b929e79f63457212ea7e46548da072200c8168217f3e4daf63a49810a76f	2025-08-23 15:35:55.03	2025-08-23 15:35:55.03
0199258e-2bdf-76f0-9d0f-39f6e66e993b	0199258e-2a3a-722e-88fe-e19dceafa723	credential	0199258e-2a3a-722e-88fe-e19dceafa723	\N	\N	\N	\N	\N	\N	eb0f5b51de9b378f4e17b65e7d9a7e1e:4c4cbe4072c168c5e86d56723ccf2d180c4124d79b554f163d8d6f735ffcd0f640ddb93652a500278a422e697fa1e7397599cc1464c741fe3f722925101f3e73	2025-09-07 19:01:38.399	2025-09-07 19:01:38.399
0198d86e-40cd-7236-a370-cfbe751a8e5f	0198d86e-3ed0-7bf2-9317-674ef372c7db	credential	0198d86e-3ed0-7bf2-9317-674ef372c7db	\N	\N	\N	\N	\N	\N	917ce45cb974911b17805884fa6442a7:3832c0072cde54d32f6324184b8fc208d6f06dfbaa02b2855ec7fa3ae72f3a1659b943d8709c888774e65c4fd639aa404e421dbda3aae4f9a4b8eed5d017b1b3	2025-08-23 15:36:00.941	2025-08-23 15:36:00.941
0199258e-e517-7481-a375-75395b5d4a58	0199258e-e3f0-74df-b56a-8841ec9bcd35	credential	0199258e-e3f0-74df-b56a-8841ec9bcd35	\N	\N	\N	\N	\N	\N	e9f8fed8f379b5cdd0c590e5668da6f1:10a1ababb7794b2ffda59eee4fff8155580775acb9f3b0fcf313e287a52cb42c0b6347fda03169f3424bfa520dc69fd58da75efcb6369d3a4b3b4514f0970577	2025-09-07 19:02:25.815	2025-09-07 19:02:25.815
0198d872-41e9-71cf-b1cf-38aa0f2a97e9	0198d872-3eda-781e-910f-e8d109fbb967	credential	0198d872-3eda-781e-910f-e8d109fbb967	\N	\N	\N	\N	\N	\N	215d130f146109fb40ee14c2b35e0a94:b4fb9c3632cd3066798e82f3e69dc451cf720aed311e24794604a58175e902b15c7b8833322ff69994b74e169c60e2edb47694a4791e17b7231ac178ccdfb859	2025-08-23 15:40:23.4	2025-08-23 15:40:23.4
0199258f-5dee-75fd-8799-3a99ced3a138	0199258f-5cb6-7998-b7db-d44c86f0149e	credential	0199258f-5cb6-7998-b7db-d44c86f0149e	\N	\N	\N	\N	\N	\N	5280bd8a5e70508ab5946ff5cf315e14:242265fad50cef5b27055ecdc3c3343d4cef04764c3ac0db19c263077b1d605ed03cf56cb0c58ca9ccb4aec2634cebeb4923a5cbb14b0c2090a4dc08e9e12b0c	2025-09-07 19:02:56.75	2025-09-07 19:02:56.75
0198aed6-cf7c-78ce-917f-87cb0475eb67	0198aed6-cc0b-783b-b414-c5fb8a81f227	credential	0198aed6-cc0b-783b-b414-c5fb8a81f227	\N	\N	\N	\N	\N	\N	$2b$12$UkgwO6dP5ESpW4LcTIneguT5qCkwGzl4vPEuLxlhJsym0cUL6Jfza	2025-08-15 13:46:10.17	2025-08-17 12:41:50.516602
0198b046-d417-7959-b179-e182de5ea58c	0198b046-d127-769d-9bc2-8e5824b71b3a	credential	0198b046-d127-769d-9bc2-8e5824b71b3a	\N	\N	\N	\N	\N	\N	132c624bc16310d13c18137e9e07a6c1:5f03f8d47d52faf071a0c871d191ae59d9ebabe36a66cd9f48c8766f1db6ed12194f0d7ccf45d2197ae6bd5586d832ba5cad119be3f69f23e2599d44c6d3891f	2025-08-15 20:28:08.598	2025-08-17 12:55:09.422639
01992590-a57e-71d5-bb55-37c068c8dfe2	01992590-a15f-71af-a149-08f58d356bdb	credential	01992590-a15f-71af-a149-08f58d356bdb	\N	\N	\N	\N	\N	\N	3f4fec21a99867823d12083b227e8fcc:e9088923e216c9792aa24828e2c3a981dea5219f14078e19350dc9ec6d7325068e82c5632a8245c80abff09beae4416ac4b25b4aa5f1c608ffcf8e14b1467da9	2025-09-07 19:04:20.606	2025-09-07 19:04:20.606
0198b2d6-f2ab-729d-8009-e5eda40674ba	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	credential	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	\N	\N	\N	\N	\N	\N	88eba63d13a9d903593ab5b0fa23be53:984fd32fecb6c8270cfa9ba42e71e2c519b0ec520e4cb16814f984e64eacfea84375e817ad674521485332f93bdbce615d18cfc0e2e5f739485cb0d54bb94bd4	2025-08-16 08:24:48.043	2025-08-16 08:24:48.043
0198b046-e3c4-7d30-b229-4c331594aff2	0198b046-e16b-7b46-a15e-baa49fd29990	credential	0198b046-e16b-7b46-a15e-baa49fd29990	\N	\N	\N	\N	\N	\N	$2b$12$68H96svCejJIiTnncWJO/.KGreKFVgVylSL7TAiBxwFx5KZoUB3/O	2025-08-15 20:28:12.612	2025-08-17 12:55:10.186406
0198b046-eb49-7a71-b01f-e90e09b6d1f3	0198b046-e873-7739-bac2-10db9440486b	credential	0198b046-e873-7739-bac2-10db9440486b	\N	\N	\N	\N	\N	\N	$2b$12$mALd9lLsH5p5TzERnvAmSOgaG6GD/CzdPemEkd2UII8pODiPn7iKe	2025-08-15 20:28:14.537	2025-08-17 12:55:10.609352
0198b046-f2ae-7c59-8714-f327c6626a5c	0198b046-f056-7735-a3aa-60e8a329dd23	credential	0198b046-f056-7735-a3aa-60e8a329dd23	\N	\N	\N	\N	\N	\N	$2b$12$CKAeG/Wme8JtNsQaDnnBkuTY9a898Me3/fDsPJ7Ym9k8wCE8njn4O	2025-08-15 20:28:16.43	2025-08-17 12:55:11.082967
0198b046-f958-782b-af9c-707c2a3a22a5	0198b046-f71e-7bec-a853-294d7cbcbda5	credential	0198b046-f71e-7bec-a853-294d7cbcbda5	\N	\N	\N	\N	\N	\N	$2b$12$VdwNBJWrtU2GynBWVd3xjeYrvdkRQudkKntGOyH6PAhbkOLfXZ4FW	2025-08-15 20:28:18.136	2025-08-17 12:55:11.605335
0198b047-0117-7052-b246-a59076c5eb4d	0198b046-fe7a-7855-b4d8-4408253dc9c5	credential	0198b046-fe7a-7855-b4d8-4408253dc9c5	\N	\N	\N	\N	\N	\N	$2b$12$.e0lFAaKpiSYmrHFk9AgseXwDrGtPipiPBR78qwLBcX3gD87vknm.	2025-08-15 20:28:20.118	2025-08-17 12:55:12.018692
0198b046-cbe0-7f68-a1ed-361fb868f90d	0198b046-c453-72d9-b71a-092e1f75601a	credential	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	\N	\N	\N	\N	1e6ae2822930932a48ac98d40244c50e:959b5fe47cd091564b4f4cefa2dfa6badfc139a58b0c12641a16616d37ce86db7b328b2c30884ac77a8bd0fb589b2491d6a3e19dad418911beec9c41bd6b47b9	2025-08-15 20:28:06.496	2025-08-17 12:55:09.026104
0198b046-dcaa-79d6-b752-2500ac8a70a0	0198b046-d931-7772-a1e8-b63c68c7f43d	credential	0198b046-d931-7772-a1e8-b63c68c7f43d	\N	\N	\N	\N	\N	\N	ef938dff1c3f0f0632a550fcd129f7e9:e80c65faa89d32ca856122c1e5209cce10c99b9d6b4b2b5ab5942d1e517300dfce5e15e2c78eab568336370944c3bf5e5fe14ecbf74676bd40ac1c5cc0d84c29	2025-08-15 20:28:10.793	2025-08-17 12:55:09.828288
\.


--
-- Data for Name: change_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at) FROM stdin;
3fc2f68d-f498-4b44-bcff-4f56a5e224dd	0/2000001	123e4567-e89b-12d3-a456-426614174000	test_stats	insert	{"test": "data"}	\N	2025-08-14 23:47:08.115281
2f909fd9-59ec-43ea-bbce-a98f568d1acc	0/1000001	123e4567-e89b-12d3-a456-426614174000	org_projects	insert	{"id": "proj-1", "name": "Org 1 Project"}	\N	2025-08-15 01:08:15.728444
80575c13-dfea-4362-86dc-3a2b69e1989c	0/1000002	987fcdeb-51a2-43d7-8293-123456789abc	org_tasks	insert	{"id": "task-1", "title": "Org 2 Task"}	\N	2025-08-15 01:08:15.728444
57a9061e-d568-4dda-9251-ce0523b949d2	0/1000003	123e4567-e89b-12d3-a456-426614174000	webhooks_table	update	{"id": "webhook-1", "status": "processed"}	\N	2025-08-15 01:08:15.728444
261ef98d-1361-4157-b67a-72b79c083f5e	0/16B2C48	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "01234567-1111-7777-8888-123456789abc", "name": "TechFlow Project Alpha", "description": "Secret project for TechFlow only", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-client-1	2025-08-15 19:10:48.205735
96494010-3906-490a-9573-aef06befb2b4	0/16B2C49	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "01234567-2222-7777-8888-123456789abc", "title": "TechFlow Task Alpha", "description": "Confidential task for TechFlow team", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-client-1	2025-08-15 19:10:48.209945
0f4b048a-f0d8-4b82-98b6-d144d38d41c2	0/16B2C50	01234567-89ab-cdef-0123-456789abcdef	projects	insert	{"id": "01234567-3333-7777-8888-123456789abc", "name": "Isolation Test Project", "description": "This should NOT be visible to TechFlow", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	isolation-client-1	2025-08-15 19:10:48.212595
ea8c1899-2797-45a9-a742-cb150e639703	0/16B2C51	01234567-89ab-cdef-0123-456789abcdef	tasks	insert	{"id": "01234567-4444-7777-8888-123456789abc", "title": "Isolation Test Task", "description": "This should NOT be visible to TechFlow either", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	isolation-client-1	2025-08-15 19:10:48.215454
700e3564-6269-4830-9aa7-7728295dfa8a	0/16B2C52	934fd0a8-f306-4f13-a544-094282f047eb	tasks	update	{"id": "01234567-2222-7777-8888-123456789abc", "title": "TechFlow Task Alpha - Updated", "status": "in_progress", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-client-2	2025-08-15 19:10:48.217713
bac313e3-c1ea-461c-837e-c2e27ac52efd	0/16B2C48	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "abc03c39-f53f-4d8d-990b-1a5a955c7696", "name": "TechFlow Project - Should be visible", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-test	2025-08-15 19:17:28.853959
fb032c9a-7ec1-457e-a1ad-297176b36356	0/16B2C48	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "e03c2f30-93c1-4c7a-8c40-adf03daf4f35", "name": "TechFlow Project - Should be visible", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-test	2025-08-15 19:17:49.469012
006be6d4-9d88-4134-ad36-c3b1eb14494a	0/16B2C49	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "9ec114de-b0f3-4c98-a67b-ee6772d57afe", "name": "Other Org Project - Should NOT be visible", "organization_id": "11111111-2222-3333-4444-555555555555"}	other-test	2025-08-15 19:17:49.472838
96ec0e89-1f70-4dd8-99dd-8d0ef5ba6fe9	0/16B2C60	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "3377394f-b1b7-4892-b125-047021fa95c8", "title": "TechFlow Sync Test Task", "description": "This should be visible to TechFlow sync", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-sync-test	2025-08-15 19:39:53.22383
3f7e8a02-619a-4efd-8dfa-836cae8bf9c6	0/16B2C61	11111111-2222-3333-4444-555555555555	tasks	insert	{"id": "c6a491b3-5c81-4d14-bf77-3083b54f61c4", "title": "Other Org Sync Test Task", "description": "This should NOT be visible to TechFlow sync", "organization_id": "11111111-2222-3333-4444-555555555555"}	other-sync-test	2025-08-15 19:39:53.23248
bcd16699-4d0e-4c03-bcf0-23202df06a04	0/16B2C62	934fd0a8-f306-4f13-a544-094282f047eb	projects	update	{"id": "908ff3d1-0a23-4770-a532-25837fe6a852", "name": "TechFlow Updated Project", "status": "in_progress", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	techflow-sync-test	2025-08-15 19:39:53.235188
d372606c-05ef-418f-811f-3015d352e778	0/16B2D01	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "55483241-3bbb-48ee-9d4e-0d900859f0ce", "name": "TechFlow Secret Project Alpha", "budget": 150000, "description": "CONFIDENTIAL: This should only be visible to TechFlow", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:47:56.441988
8474c9ea-8eda-40df-ae2b-36b39cf41c99	0/16B2D02	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "d8f3a37c-ae11-4656-af53-abfd36990db3", "title": "TechFlow Internal Task", "description": "Internal task - should not leak to other orgs", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:47:56.460062
632a7c62-d75b-47d2-b087-e5fe17a0c39e	0/16B2D03	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "02858881-f761-41f1-bbdf-1f6fefc55028", "name": "COMPETITOR SECRET PROJECT", "budget": 200000, "description": "This should NEVER be visible to TechFlow!", "organization_id": "11111111-2222-3333-4444-555555555555"}	payload-test-competitor	2025-08-15 19:47:56.465474
7b7bf788-38dc-44c1-affc-3f71f1c61950	0/16B2D01	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "5934a245-fcc1-404f-9717-cc37a4d7e756", "name": "TechFlow Secret Project Alpha", "budget": 150000, "description": "CONFIDENTIAL: This should only be visible to TechFlow", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:55:33.816187
f188cde2-910b-4cda-af88-a18944f3ad53	0/16B2D02	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "f6bcde26-77ee-4fab-97a9-d7b7c63904d4", "title": "TechFlow Internal Task", "description": "Internal task - should not leak to other orgs", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 19:55:33.823465
473ccd98-e3a3-49b4-8c3d-c23067da7bd6	0/16B2D03	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "6b8b9fd5-b55b-4db2-91b5-b59532357f6e", "name": "COMPETITOR SECRET PROJECT", "budget": 200000, "description": "This should NEVER be visible to TechFlow!", "organization_id": "11111111-2222-3333-4444-555555555555"}	payload-test-competitor	2025-08-15 19:55:33.825596
0f805e39-7cce-4db7-b454-53eea9400b6f	0/16B2D01	934fd0a8-f306-4f13-a544-094282f047eb	projects	insert	{"id": "cd7ba359-b86e-43fc-9920-c421018041c4", "name": "TechFlow Secret Project Alpha", "budget": 150000, "description": "CONFIDENTIAL: This should only be visible to TechFlow", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 20:00:24.375541
526f0fd9-bdcd-4fb2-95ae-04664de838bf	0/16B2D02	934fd0a8-f306-4f13-a544-094282f047eb	tasks	insert	{"id": "6962f173-59fa-4841-a740-8a5f54d1169f", "title": "TechFlow Internal Task", "description": "Internal task - should not leak to other orgs", "organization_id": "934fd0a8-f306-4f13-a544-094282f047eb"}	payload-test-techflow	2025-08-15 20:00:24.380905
40638ca5-6274-4b6a-a6c6-21e1c0d1ba02	0/16B2D03	11111111-2222-3333-4444-555555555555	projects	insert	{"id": "28a2ec89-620f-4b71-8cba-16ad3fa5adf0", "name": "COMPETITOR SECRET PROJECT", "budget": 200000, "description": "This should NEVER be visible to TechFlow!", "organization_id": "11111111-2222-3333-4444-555555555555"}	payload-test-competitor	2025-08-15 20:00:24.382951
467b8e94-e11d-4a9d-95ce-cfbdece78302	0/25CF490	01234567-89ab-cdef-0123-456789abcdef	organizations	insert	{"id": "01234567-89ab-cdef-0123-456789abcdef", "name": "Isolation Test Organization", "slug": "isolation-test-org", "country": "", "logoUrl": "", "industry": "", "maxUsers": 5, "settings": [], "timezone": "UTC", "createdAt": "2025-08-15 19:10:48.199738+00", "deletedAt": "", "updatedAt": "2025-08-15 19:10:48.199738+00", "ssoEnabled": "", "websiteUrl": "", "companySize": "", "description": "Organization for testing data isolation", "enforce_2fa": "", "maxProjects": 3, "trialEndsAt": "", "apiRateLimit": 1000, "billingCycle": "monthly", "billingEmail": "", "allowedDomains": "", "storageLimitGb": 1, "trialStartedAt": "2025-08-15 19:10:48.199738", "billingSettings": [], "nextBillingDate": "", "polarCustomerId": "", "subscriptionTier": "trial", "subscriptionSeats": 5, "subscriptionStatus": "active", "subscriptionExpiresAt": ""}	\N	2025-08-15 16:17:14.507
5b2e2157-de06-4e4f-a36d-e278f193673c	0/25D87D0	11111111-2222-3333-4444-555555555555	organizations	insert	{"id": "11111111-2222-3333-4444-555555555555", "name": "Test Organization 2", "slug": "test-org-isolation-1755285469460", "country": "", "logoUrl": "", "industry": "", "maxUsers": 5, "settings": [], "timezone": "UTC", "createdAt": "2025-08-15 19:17:49.463226+00", "deletedAt": "", "updatedAt": "2025-08-15 19:17:49.463226+00", "ssoEnabled": "", "websiteUrl": "", "companySize": "", "description": "Second organization for isolation testing", "enforce_2fa": "", "maxProjects": 3, "trialEndsAt": "", "apiRateLimit": 1000, "billingCycle": "monthly", "billingEmail": "", "allowedDomains": "", "storageLimitGb": 1, "trialStartedAt": "2025-08-15 19:17:49.463226", "billingSettings": [], "nextBillingDate": "", "polarCustomerId": "", "subscriptionTier": "trial", "subscriptionSeats": 5, "subscriptionStatus": "active", "subscriptionExpiresAt": ""}	\N	2025-08-15 16:17:14.507
f85e2204-1816-42ba-b323-303664cb45a3	0/2650000	108b0ac2-487f-4951-b295-b1924288daad	projects	insert	{"id": "237e6163-da82-4cc9-b410-e7e8214e153c", "name": "TechFlow Website Redesign", "status": "active", "description": "Complete redesign of the TechFlow Solutions website", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.7256
c69635d8-5c59-4564-8164-2000730b2ff0	0/2650000	108b0ac2-487f-4951-b295-b1924288daad	projects	insert	{"id": "30398218-1832-4253-8f86-27d6210b7528", "name": "Client Portal Development", "status": "planning", "description": "Building a client portal for TechFlow customers", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.744744
09b0b9ea-cec9-41df-9dcd-ca30e7fe69cd	0/2650000	108b0ac2-487f-4951-b295-b1924288daad	projects	insert	{"id": "294d04b5-e040-45c0-aa6d-2bb397db96fc", "name": "Mobile App MVP", "status": "active", "description": "TechFlow mobile application minimum viable product", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.754791
09b948cb-1b04-4530-86b6-83b39eb4690f	0/2651000	108b0ac2-487f-4951-b295-b1924288daad	tasks	insert	{"id": "9a9eb4ba-e043-4476-94b1-fa6977501c66", "title": "Design new homepage layout", "status": "in_progress", "priority": "high", "project_id": "237e6163-da82-4cc9-b410-e7e8214e153c", "description": "Create wireframes and mockups for the new homepage", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.7619
3fde51be-5d92-458f-8526-e1bc5528d267	0/2651000	108b0ac2-487f-4951-b295-b1924288daad	tasks	insert	{"id": "1ee1d678-faec-4de2-acb2-626dbdc79e60", "title": "Implement responsive navigation", "status": "todo", "priority": "medium", "project_id": "237e6163-da82-4cc9-b410-e7e8214e153c", "description": "Build mobile-friendly navigation menu", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.767356
3722214c-cd68-414c-b065-3849d6bd9c37	0/2651000	108b0ac2-487f-4951-b295-b1924288daad	tasks	insert	{"id": "2109d447-f915-4136-8c97-7f8d1f2bcbed", "title": "Setup authentication system", "status": "in_progress", "priority": "high", "project_id": "30398218-1832-4253-8f86-27d6210b7528", "description": "Implement user login and registration", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	test-data-seeder	2025-08-15 20:21:02.775909
74369451-4c48-477b-b78f-e5e2ad434262	0/2652000	01234567-89ab-cdef-0123-456789abcdef	projects	insert	{"id": "3f2de8ca-bd97-4b6f-94df-02058b4fbab7", "name": "Competitor Secret Project", "status": "confidential", "description": "This should NOT appear in TechFlow sync", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	competitor-seeder	2025-08-15 20:21:02.782472
18c1adc2-35b9-4ddd-b022-fa1cc63fc993	0/2652000	01234567-89ab-cdef-0123-456789abcdef	projects	insert	{"id": "384dc651-bda5-4fd5-8552-1b020ee97a5d", "name": "Rival Product Launch", "status": "stealth", "description": "Competitor product that TechFlow should not see", "organization_id": "01234567-89ab-cdef-0123-456789abcdef"}	competitor-seeder	2025-08-15 20:21:02.787157
7a9bc7f4-4d71-47a6-b8c1-7927a95f1f21	0/2653000	108b0ac2-487f-4951-b295-b1924288daad	time_entries	insert	{"id": "ea5ad0f8-d397-4c7a-8ff1-50efa3dccf43", "date": "2025-08-15", "hours": 3.5, "task_id": "9a9eb4ba-e043-4476-94b1-fa6977501c66", "user_id": "0198aed6-cc0b-783b-b414-c5fb8a81f227", "description": "Working on homepage design mockups", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	time-tracker	2025-08-15 20:21:02.794204
05d4d860-2ee7-4866-8bcc-b22d9d1c55c7	0/2653000	108b0ac2-487f-4951-b295-b1924288daad	time_entries	insert	{"id": "c9e04350-13ff-4333-ab29-475d1d473d46", "date": "2025-08-15", "hours": 2, "task_id": "2109d447-f915-4136-8c97-7f8d1f2bcbed", "user_id": "0198aed6-cc0b-783b-b414-c5fb8a81f227", "description": "Setting up OAuth integration", "organization_id": "108b0ac2-487f-4951-b295-b1924288daad"}	time-tracker	2025-08-15 20:21:02.79948
\.


--
-- Data for Name: container_permission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.container_permission (id, user_id, permission_container_type, permission_container_id, role, granted_at, granted_by_id, expires_at, restrictions, status, created_at, updated_at) FROM stdin;
a808f1b4-83a3-4df5-be20-c45cdc084b7c	0198b046-c453-72d9-b71a-092e1f75601a	organization	01920000-1000-7000-8000-000000000001	owner	2025-08-16 00:28:20.626573+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.626573+00	2025-08-16 00:28:20.626573+00
c5450264-0503-4562-9937-41d00246ccbb	0198b046-d127-769d-9bc2-8e5824b71b3a	organization	01920000-1000-7000-8000-000000000001	admin	2025-08-16 00:28:20.628806+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.628806+00	2025-08-16 00:28:20.628806+00
f6c6a74c-2ac2-45ef-bdaa-3189e0c59be9	0198b046-d931-7772-a1e8-b63c68c7f43d	organization	01920000-1000-7000-8000-000000000001	manager	2025-08-16 00:28:20.630663+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.630663+00	2025-08-16 00:28:20.630663+00
645a3ab6-da28-4797-b88a-b0267b5aa83e	0198b046-e16b-7b46-a15e-baa49fd29990	organization	01920000-1000-7000-8000-000000000001	manager	2025-08-16 00:28:20.632425+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.632425+00	2025-08-16 00:28:20.632425+00
f2758a5e-b37b-40e9-b2f5-d77912418fc1	0198b046-e873-7739-bac2-10db9440486b	organization	01920000-1000-7000-8000-000000000001	member	2025-08-16 00:28:20.634086+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.634086+00	2025-08-16 00:28:20.634086+00
e323d8d1-2e35-4ddf-96b3-9d422f7310da	0198b046-f056-7735-a3aa-60e8a329dd23	organization	01920000-1000-7000-8000-000000000001	member	2025-08-16 00:28:20.635645+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.635645+00	2025-08-16 00:28:20.635645+00
ebf1accb-6550-4870-b161-ffe89445f5ea	0198b046-f71e-7bec-a853-294d7cbcbda5	organization	01920000-1000-7000-8000-000000000001	contributor	2025-08-16 00:28:20.638277+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.638277+00	2025-08-16 00:28:20.638277+00
c2bdc82f-b821-4b62-a5f2-cb9299710883	0198b046-fe7a-7855-b4d8-4408253dc9c5	organization	01920000-1000-7000-8000-000000000001	viewer	2025-08-16 00:28:20.640171+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	\N	active	2025-08-16 00:28:20.640171+00	2025-08-16 00:28:20.640171+00
b923088f-fbbb-4956-8fe5-57958b335bc1	0198b046-f71e-7bec-a853-294d7cbcbda5	project	75972222-1a82-425e-8ad4-bff95105df92	manager	2025-08-16 00:28:20.642009+00	0198b046-c453-72d9-b71a-092e1f75601a	\N	{"canEditBudget": true, "canManageTeam": true}	active	2025-08-16 00:28:20.642009+00	2025-08-16 00:28:20.642009+00
b3c2c5e8-a694-4bac-ba5e-74bc0ad19823	0198b059-5419-7165-b2c3-937a66b94865	organization	01920000-2000-7000-8000-000000000002	owner	2025-08-16 00:48:25.940805+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.940805+00	2025-08-16 00:48:25.940805+00
2c456f76-53cb-453d-903a-45eba13a9456	0198b059-5999-7f84-8217-0506a838e0da	organization	01920000-2000-7000-8000-000000000002	admin	2025-08-16 00:48:25.943353+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.943353+00	2025-08-16 00:48:25.943353+00
745b49c9-fe6d-45c1-a256-da67d47538b6	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	organization	01920000-2000-7000-8000-000000000002	member	2025-08-16 00:48:25.945278+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.945278+00	2025-08-16 00:48:25.945278+00
7b2d63ed-c167-4ae5-859a-b90a0ec3ca9b	0198b059-64c9-7c4f-87be-5b1a3704f1c3	organization	01920000-2000-7000-8000-000000000002	viewer	2025-08-16 00:48:25.94719+00	0198b059-5419-7165-b2c3-937a66b94865	\N	\N	active	2025-08-16 00:48:25.94719+00	2025-08-16 00:48:25.94719+00
b413ecac-a118-4af0-b84e-500a506a3429	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	entity_type	ticket	manager	2025-08-16 00:48:25.949416+00	0198b059-5419-7165-b2c3-937a66b94865	\N	{"system_options": {"can_modify_priority": true}, "polymorphic_access": ["comment", "attachment", "activity"], "custom_field_access": ["Resolution Time"]}	active	2025-08-16 00:48:25.949416+00	2025-08-16 00:48:25.949416+00
fdb25983-b942-46b5-9d9e-2cd3b3aa0fed	0198b059-5999-7f84-8217-0506a838e0da	entity_type	deal	owner	2025-08-16 00:48:25.951413+00	0198b059-5419-7165-b2c3-937a66b94865	\N	{"system_options": {"can_modify_stage": true, "can_view_all_deals": true}, "polymorphic_access": ["comment", "attachment", "activity"], "custom_field_access": ["Source"]}	active	2025-08-16 00:48:25.951413+00	2025-08-16 00:48:25.951413+00
\.


--
-- Data for Name: custom_option_sets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_option_sets (id, org_id, option_set_type, name, description, is_active, sort_order, created_at, updated_at) FROM stdin;
13d22c5a-9351-4f0b-a3f3-157b6eea65da	01920000-1000-7000-8000-000000000001	relationship_type	Relationship Types	Available relationship types between entities	t	1	2025-09-07 11:41:55.795161	2025-09-07 11:41:55.795161
59c3d657-0a03-44ec-8dbd-e1f306a92734	01920000-1000-7000-8000-000000000001	relationship_role	Relationship Roles	Roles within relationships	t	2	2025-09-07 11:41:55.795161	2025-09-07 11:41:55.795161
5bd07690-21aa-4771-91eb-092d31ae6802	01920000-1000-7000-8000-000000000001	relationship_status	Relationship Status	Status of relationships	t	3	2025-09-07 11:41:55.795161	2025-09-07 11:41:55.795161
a7993c2d-2431-46f6-8567-a25ed13c9434	01920000-1000-7000-8000-000000000001	entity_type	Entity Types	Types of entities that can be related	t	4	2025-09-07 11:41:55.795161	2025-09-07 11:41:55.795161
\.


--
-- Data for Name: custom_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_options (id, option_set_id, value, label, description, color, icon, is_active, sort_order, metadata, created_at, updated_at) FROM stdin;
6955efdc-97f6-4432-a0fc-8635943f0bc0	13d22c5a-9351-4f0b-a3f3-157b6eea65da	assigned_to	Assigned To	User assigned to work on this item	#3B82F6	user-check	t	1	{"cardinality": "many-to-many", "allowed_source": ["Task", "Project"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
69809655-ac22-44a8-85ac-068c1a3e8f6a	13d22c5a-9351-4f0b-a3f3-157b6eea65da	blocks	Blocks	This item blocks another	#EF4444	ban	t	2	{"cardinality": "one-to-many", "allowed_source": ["Task"], "allowed_target": ["Task"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
8da16efa-c823-4ff4-ada6-d17b067cf123	13d22c5a-9351-4f0b-a3f3-157b6eea65da	blocked_by	Blocked By	This item is blocked by another	#F59E0B	alert-triangle	t	3	{"cardinality": "many-to-one", "allowed_source": ["Task"], "allowed_target": ["Task"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
4c5c8da6-3951-4cdf-abaf-adc4e8dd67e9	13d22c5a-9351-4f0b-a3f3-157b6eea65da	subtask_of	Subtask Of	This is a subtask of another	#8B5CF6	git-branch	t	4	{"cardinality": "many-to-one", "allowed_source": ["Task"], "allowed_target": ["Task"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
a8b58379-8e2f-4457-bf11-0d15e202bb9a	13d22c5a-9351-4f0b-a3f3-157b6eea65da	member_of	Member Of	Member of project or team	#10B981	users	t	5	{"cardinality": "many-to-many", "allowed_source": ["User", "Task"], "allowed_target": ["Project"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
b2fc48f9-c653-4b87-9f47-6faad0e9995f	13d22c5a-9351-4f0b-a3f3-157b6eea65da	manages	Manages	Manages this entity	#6366F1	briefcase	t	6	{"cardinality": "one-to-many", "allowed_source": ["User"], "allowed_target": ["Project", "Task"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
ddc1042a-cd72-4001-9c44-639dc7b9ca20	13d22c5a-9351-4f0b-a3f3-157b6eea65da	authored_by	Authored By	Authored by user	#EC4899	edit	t	7	{"cardinality": "many-to-many", "allowed_source": ["Document", "Invoice", "Task"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
f1620952-658f-4c65-bba8-4e4484c705f1	13d22c5a-9351-4f0b-a3f3-157b6eea65da	references	References	References another entity	#06B6D4	link	t	8	{"cardinality": "many-to-many", "allowed_source": ["*"], "allowed_target": ["*"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
95dc5483-58db-46fd-9ded-6ce661557f74	13d22c5a-9351-4f0b-a3f3-157b6eea65da	requires_approval_from	Requires Approval	Requires approval from	#F97316	check-circle	t	9	{"cardinality": "many-to-many", "allowed_source": ["Invoice", "Expense"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
215d5cd7-1af5-41fb-bcb8-40f889621056	13d22c5a-9351-4f0b-a3f3-157b6eea65da	approved_by	Approved By	Approved by user	#84CC16	check	t	10	{"cardinality": "many-to-one", "allowed_source": ["Invoice", "Expense"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
43b62ab7-764b-4590-b5f7-3865d4d31282	13d22c5a-9351-4f0b-a3f3-157b6eea65da	watching	Watching	Watching for updates	#A78BFA	eye	t	11	{"cardinality": "many-to-many", "allowed_source": ["User"], "allowed_target": ["Task", "Project"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
a85e12dc-f3e0-473b-9cbb-fd6696f59500	13d22c5a-9351-4f0b-a3f3-157b6eea65da	collaborates_with	Collaborates With	Collaborates with	#FB923C	users	t	12	{"cardinality": "many-to-many", "allowed_source": ["User"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
85d1ec91-cb71-4dd3-9976-4976b0cc4845	13d22c5a-9351-4f0b-a3f3-157b6eea65da	reports_to	Reports To	Reports to in org hierarchy	#0EA5E9	trending-up	t	13	{"cardinality": "many-to-one", "allowed_source": ["User"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
036d8ec1-907e-42db-a25e-bc9366e3401b	13d22c5a-9351-4f0b-a3f3-157b6eea65da	mentors	Mentors	Mentors another user	#7C3AED	award	t	14	{"cardinality": "one-to-many", "allowed_source": ["User"], "allowed_target": ["User"]}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
b2407d8a-4b88-4e69-97ef-3af83cc6801e	59c3d657-0a03-44ec-8dbd-e1f306a92734	owner	Owner	Primary owner	#EF4444	crown	t	1	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
a5db202d-84c9-40ba-888f-66b6b59b895b	59c3d657-0a03-44ec-8dbd-e1f306a92734	admin	Admin	Administrator	#F59E0B	shield	t	2	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
4ff4f72e-3716-4d39-a665-e059a96656e5	59c3d657-0a03-44ec-8dbd-e1f306a92734	manager	Manager	Manager role	#3B82F6	briefcase	t	3	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
e180b20c-66f4-4769-9b44-9610e663e164	59c3d657-0a03-44ec-8dbd-e1f306a92734	tech_lead	Tech Lead	Technical lead	#8B5CF6	cpu	t	4	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
78a8df79-c8a2-4620-91b8-67a40668ebae	59c3d657-0a03-44ec-8dbd-e1f306a92734	member	Member	Team member	#10B981	user	t	5	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
c1ae97ba-6417-4b76-86ef-997e25d49de1	59c3d657-0a03-44ec-8dbd-e1f306a92734	contributor	Contributor	Active contributor	#06B6D4	git-commit	t	6	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
c2fb3029-e120-4d58-b493-796562907c58	59c3d657-0a03-44ec-8dbd-e1f306a92734	reviewer	Reviewer	Reviews work	#EC4899	eye	t	7	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
88b5095c-d35d-4db9-96a0-7cdf672f0693	59c3d657-0a03-44ec-8dbd-e1f306a92734	viewer	Viewer	Read-only access	#6B7280	eye-off	t	8	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
974024c5-b012-4183-86f1-43681a6786ce	59c3d657-0a03-44ec-8dbd-e1f306a92734	stakeholder	Stakeholder	Key stakeholder	#F97316	star	t	9	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
2a2ddf63-1d67-47b0-928d-11830bf90f22	59c3d657-0a03-44ec-8dbd-e1f306a92734	approver	Approver	Can approve	#84CC16	check-circle	t	10	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
950b41df-f697-48df-b4ab-092448f50472	5bd07690-21aa-4771-91eb-092d31ae6802	active	Active	Currently active	#10B981	play	t	1	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
996a3741-dc98-4614-b48e-6d53a73b826a	5bd07690-21aa-4771-91eb-092d31ae6802	pending	Pending	Pending approval	#F59E0B	clock	t	2	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
32bbd45a-9d74-4134-b744-c39df524a611	5bd07690-21aa-4771-91eb-092d31ae6802	suspended	Suspended	Temporarily suspended	#EF4444	pause	t	3	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
2f8a04bd-42fc-46e2-bd46-0d7039d5d223	5bd07690-21aa-4771-91eb-092d31ae6802	expired	Expired	No longer valid	#6B7280	x-circle	t	4	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
0a1142d5-ace1-4cdd-9d01-8b650d316a72	5bd07690-21aa-4771-91eb-092d31ae6802	archived	Archived	Archived for history	#9CA3AF	archive	t	5	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
a4c15158-ee4c-4d9e-ab05-c9b33e370313	a7993c2d-2431-46f6-8567-a25ed13c9434	User	User	System user	#3B82F6	user	t	1	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
203b1c40-7e89-4f2c-9398-2ad41c9048e2	a7993c2d-2431-46f6-8567-a25ed13c9434	Task	Task	Task entity	#10B981	check-square	t	2	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
328bb7e7-5210-41d1-9268-9f1787054afc	a7993c2d-2431-46f6-8567-a25ed13c9434	Project	Project	Project entity	#8B5CF6	folder	t	3	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
ad4ab97f-111b-4f66-bf9d-fb026c573764	a7993c2d-2431-46f6-8567-a25ed13c9434	Document	Document	Document entity	#F59E0B	file-text	t	4	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
a4de0898-e0ed-4c2a-9cc7-c04c6cc2ead8	a7993c2d-2431-46f6-8567-a25ed13c9434	Invoice	Invoice	Invoice entity	#EF4444	dollar-sign	t	5	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
011e15f5-4405-477b-bb9b-79ec559d2d1a	a7993c2d-2431-46f6-8567-a25ed13c9434	File	File	File entity	#06B6D4	paperclip	t	6	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
f26596bd-182f-46f1-9845-a0975a81c530	a7993c2d-2431-46f6-8567-a25ed13c9434	Discussion	Discussion	Discussion entity	#EC4899	message-circle	t	7	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
00ab1261-0610-4f54-8572-8e72d2071f58	a7993c2d-2431-46f6-8567-a25ed13c9434	Meeting	Meeting	Meeting entity	#F97316	calendar	t	8	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
d29bc182-535e-4f3d-a7a1-d19c381795b4	a7993c2d-2431-46f6-8567-a25ed13c9434	Contract	Contract	Contract entity	#7C3AED	file-plus	t	9	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
f4edeb74-1848-47bb-bfff-142286d8339e	a7993c2d-2431-46f6-8567-a25ed13c9434	Expense	Expense	Expense entity	#DC2626	credit-card	t	10	{}	2025-09-07 11:41:55.802995	2025-09-07 11:41:55.802995
\.


--
-- Data for Name: dataforge_relationship_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dataforge_relationship_fields (id, org_id, entity_type, field_name, relationship_type, target_entity_type, cardinality, display_format, validation_rules, ui_config, created_at, updated_at) FROM stdin;
9c4706a6-9dfd-4060-8344-c7cdb1ef5d6c	01920000-1000-7000-8000-000000000001	Task	assignees	assigned_to	User	many-to-many	{name} ({role})	\N	{"component": "multi-select", "searchable": true, "show_avatar": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
936b7896-f5c5-45cd-a77b-4e53bb991681	01920000-1000-7000-8000-000000000001	Task	blocked_by_tasks	blocked_by	Task	many-to-one	{title}	\N	{"component": "single-select", "searchable": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
e72c80c0-811e-47f6-8a49-a2011eeba594	01920000-1000-7000-8000-000000000001	Task	blocks_tasks	blocks	Task	one-to-many	{title}	\N	{"component": "multi-select", "searchable": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
c99b903d-a0ba-42e3-a300-777e28cbf8c4	01920000-1000-7000-8000-000000000001	Task	parent_task	subtask_of	Task	many-to-one	{title}	\N	{"component": "single-select", "searchable": true, "show_hierarchy": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
9a4d5626-0dbf-45d8-a2f3-55175cf30ac9	01920000-1000-7000-8000-000000000001	Task	watchers	watched_by	User	many-to-many	{name}	\N	{"component": "multi-select", "searchable": true, "show_avatar": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
5ea9a42b-5d9d-42bc-9e42-e479b17ac2e3	01920000-1000-7000-8000-000000000001	Project	members	member_of	User	many-to-many	{name} ({role})	\N	{"component": "multi-select", "searchable": true, "show_avatar": true, "group_by_role": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
6cccf304-c2d9-4dd1-9a4c-3792f73cbcf1	01920000-1000-7000-8000-000000000001	Project	manager	managed_by	User	many-to-one	{name}	\N	{"component": "single-select", "searchable": true, "show_avatar": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
607245db-b0f2-4780-991e-82d1487b0c32	01920000-1000-7000-8000-000000000001	Invoice	author	authored_by	User	many-to-one	{name}	\N	{"component": "single-select", "searchable": true, "show_avatar": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
ef62a5b4-1979-481d-b705-cdcd62399398	01920000-1000-7000-8000-000000000001	Invoice	approvers	requires_approval_from	User	many-to-many	{name} (Level {approval_level})	\N	{"component": "approval-chain", "searchable": true, "show_levels": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
4a54c4d0-b1e0-4715-bab1-f9252f1f3046	01920000-1000-7000-8000-000000000001	Invoice	related_project	references	Project	many-to-one	{name}	\N	{"component": "single-select", "searchable": true}	2025-09-07 11:41:55.8173	2025-09-07 11:41:55.8173
87ac83f6-b669-4d3c-9095-0d61c14f5c8e	01920000-1000-7000-8000-000000000001	TeamTask	assignee_id	assigned_to	User	many-to-many	{{source}} assigned_to {{target}}	\N	"{\\"icon\\":\\"user-check\\",\\"color\\":\\"#3B82F6\\",\\"showInGrid\\":true,\\"showInDetail\\":true}"	2025-09-07 12:24:26.808	2025-09-07 12:24:26.810403
aeecb015-1eee-47f0-93c1-d2eb8f3eae8a	01920000-1000-7000-8000-000000000001	TeamTask	parent_task_id	subtask_of	Task	many-to-one	{{source}} subtask_of {{target}}	\N	"{\\"icon\\":\\"git-branch\\",\\"color\\":\\"#8B5CF6\\",\\"showInGrid\\":true,\\"showInDetail\\":true}"	2025-09-07 12:24:26.812	2025-09-07 12:24:26.813578
9ce87e09-be07-4f78-852c-e897d5ff1aa8	01920000-1000-7000-8000-000000000001	TeamTask	project_id	belongs_to	Project	many-to-one	{{source}} belongs_to {{target}}	\N	"{\\"icon\\":\\"folder\\",\\"color\\":\\"#6B7280\\",\\"showInGrid\\":true,\\"showInDetail\\":true}"	2025-09-07 12:24:26.815	2025-09-07 12:24:26.815854
ea02996e-fcd6-4bca-ad4b-4f2b455be62a	01920000-1000-7000-8000-000000000001	TestProduct	parent_record_id	child_of	Record	many-to-one	{{source}} child_of {{target}}	\N	"{\\"icon\\":\\"link-2\\",\\"color\\":\\"#64748B\\",\\"showInGrid\\":true,\\"showInDetail\\":true}"	2025-09-07 15:03:27.136	2025-09-07 15:03:27.137341
020fac2d-f211-4c1b-b2dd-69b1160c42ef	01920000-1000-7000-8000-000000000001	TestProduct	owner_id	owned_by	User	many-to-one	{{source}} owned_by {{target}}	\N	"{\\"icon\\":\\"crown\\",\\"color\\":\\"#FBBF24\\",\\"showInGrid\\":true,\\"showInDetail\\":true}"	2025-09-07 15:03:27.139	2025-09-07 15:03:27.140188
\.


--
-- Data for Name: entity_schemas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entity_schemas (org_id, entity_name, table_name, archetype, business_metadata, created_at, updated_at, deleted, deleted_at) FROM stdin;
01920000-1000-7000-8000-000000000001	Testdocument1757185633379	org_01920000_1000_7000_8000_000000000001_testdocument1757185633379	document	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false, "fieldSetRef": "document-status"}, {"name": "category", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}], "archetype": "document", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false, "fieldSetRef": "document-status"}, {"name": "category", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:13.464	2025-09-06 21:19:01.457	t	2025-09-06 21:19:01.457
01920000-1000-7000-8000-000000000001	SchemaTestEntity	org_01920000_1000_7000_8000_000000000001_schema_test_entity	record	{}	2025-09-03 13:16:24.733	2025-09-06 14:53:19.573	t	2025-09-06 14:53:19.573
01920000-1000-7000-8000-000000000001	Testtask1757185634598	org_01920000_1000_7000_8000_000000000001_testtask1757185634598	task	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "archetype": "task", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:14.674	2025-09-06 21:19:02.039	t	2025-09-06 21:19:02.039
01920000-1000-7000-8000-000000000001	Testtask1757185723520	org_01920000_1000_7000_8000_000000000001_testtask1757185723520	task	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "archetype": "task", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:43.605	2025-09-06 21:19:02.611	t	2025-09-06 21:19:02.611
01920000-1000-7000-8000-000000000001	Testcollection1757185634050	org_01920000_1000_7000_8000_000000000001_testcollection1757185634050	collection	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "collection_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "items", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false, "defaultValue": []}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}], "archetype": "collection", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "collection_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "items", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false, "defaultValue": []}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:14.128	2025-09-06 21:19:11.837	t	2025-09-06 21:19:11.836
01920000-1000-7000-8000-000000000001	CapitolBuilding	org_01920000_1000_7000_8000_000000000001_capitol_building	record	{}	2025-09-06 07:54:36.224	2025-09-07 16:35:14.05	t	2025-09-07 16:35:14.05
01920000-1000-7000-8000-000000000001	Invoice	org_01920000_1000_7000_8000_000000000001_invoice	document	{"fields": [{"name": "title", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "content", "type": "rich_text", "required": false, "syncable": true, "serverOnly": false}, {"name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "draft"}, {"name": "category", "type": "category_option", "required": false, "syncable": true, "serverOnly": false}, {"name": "author_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "description": "Entity metadata generated for Invoice document archetype"}	2025-08-23 19:15:53.701	2025-08-23 19:15:53.701	f	\N
01920000-1000-7000-8000-000000000001	TestProductFixed	org_01920000_1000_7000_8000_000000000001_testproductfixed	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "record_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"enum": ["active", "inactive", "archived", "draft"], "name": "status", "type": "status_option", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "defaultValue": "active"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "product_code", "type": "text", "source": "custom", "required": true}, {"name": "unit_price", "type": "number", "source": "custom", "defaultValue": 0}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "record_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"enum": ["active", "inactive", "archived", "draft"], "name": "status", "type": "status_option", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "defaultValue": "active"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": [{"name": "product_code", "type": "text", "source": "custom", "required": true}, {"name": "unit_price", "type": "number", "source": "custom", "defaultValue": 0}]}	2025-09-06 15:52:30.685	2025-09-06 21:19:03.189	t	2025-09-06 21:19:03.189
01920000-1000-7000-8000-000000000001	Testfile1757185633585	org_01920000_1000_7000_8000_000000000001_testfile1757185633585	file	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "file_path", "type": "text", "source": "archetype", "required": true, "syncable": false, "archetype": "file", "serverOnly": true}, {"name": "mime_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "size_bytes", "type": "integer", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false, "fieldSetRef": "file-status"}, {"name": "uploaded_by", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "file", "serverOnly": false}], "archetype": "file", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "file_path", "type": "text", "source": "archetype", "required": true, "syncable": false, "archetype": "file", "serverOnly": true}, {"name": "mime_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "size_bytes", "type": "integer", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false, "fieldSetRef": "file-status"}, {"name": "uploaded_by", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "file", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:13.67	2025-09-06 21:19:03.763	t	2025-09-06 21:19:03.763
01920000-1000-7000-8000-000000000001	Testrecord1757185634997	org_01920000_1000_7000_8000_000000000001_testrecord1757185634997	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "customer_name", "type": "text", "source": "custom", "required": true}, {"name": "order_total", "type": "number", "source": "custom", "defaultValue": 0}, {"name": "is_premium", "type": "boolean", "source": "custom", "defaultValue": false}, {"name": "metadata", "type": "json", "source": "custom", "defaultValue": {}}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": [{"name": "customer_name", "type": "text", "source": "custom", "required": true}, {"name": "order_total", "type": "number", "source": "custom", "defaultValue": 0}, {"name": "is_premium", "type": "boolean", "source": "custom", "defaultValue": false}, {"name": "metadata", "type": "json", "source": "custom", "defaultValue": {}}]}	2025-09-06 19:07:15.071	2025-09-06 21:19:04.338	t	2025-09-06 21:19:04.338
01920000-1000-7000-8000-000000000001	Testrecord1757185723691	org_01920000_1000_7000_8000_000000000001_testrecord1757185723691	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:43.978	2025-09-06 21:19:04.925	t	2025-09-06 21:19:04.925
01920000-1000-7000-8000-000000000001	Testcollection1757185724698	org_01920000_1000_7000_8000_000000000001_testcollection1757185724698	collection	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "collection_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "items", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false, "defaultValue": []}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}], "archetype": "collection", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "collection_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "items", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false, "defaultValue": []}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:44.797	2025-09-06 21:19:05.502	t	2025-09-06 21:19:05.502
01920000-1000-7000-8000-000000000001	TestDuplicate1757185985139	org_01920000_1000_7000_8000_000000000001_testduplicate1757185985139	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:13:05.228	2025-09-06 21:19:06.072	t	2025-09-06 21:19:06.072
01920000-1000-7000-8000-000000000001	Testtask1757185633070	org_01920000_1000_7000_8000_000000000001_testtask1757185633070	task	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "archetype": "task", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:13.157	2025-09-06 21:19:14.116	t	2025-09-06 21:19:14.116
01920000-1000-7000-8000-000000000001	EmergencyContact	org_01920000_1000_7000_8000_000000000001_emergency_contact	record	{}	2025-09-06 07:55:23.797	2025-09-07 16:35:14.058	t	2025-09-07 16:35:14.058
01920000-1000-7000-8000-000000000001	TimeSheet	org_01920000_1000_7000_8000_000000000001_time_sheet	activity	{"fields": [{"name": "activity_type", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "description", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "entity_type", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "entity_id", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "metadata", "type": "json", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "description": "Entity metadata generated for Timesheet activity archetype"}	2025-08-23 19:16:19.782	2025-09-07 16:35:14.061	t	2025-09-07 16:35:14.061
01920000-1000-7000-8000-000000000001	Testactivity1757185633755	org_01920000_1000_7000_8000_000000000001_testactivity1757185633755	activity	{"version": "2.0", "allFields": [{"name": "activity_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_type", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_id", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "metadata", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}], "archetype": "activity", "baseFields": [{"name": "activity_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_type", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_id", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "metadata", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:13.833	2025-09-06 21:19:06.647	t	2025-09-06 21:19:06.647
01920000-1000-7000-8000-000000000001	Testdocument1757185635295	org_01920000_1000_7000_8000_000000000001_testdocument1757185635295	document	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false, "fieldSetRef": "document-status"}, {"name": "category", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}], "archetype": "document", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false, "fieldSetRef": "document-status"}, {"name": "category", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:15.369	2025-09-06 21:19:07.24	t	2025-09-06 21:19:07.239
01920000-1000-7000-8000-000000000001	Testdocument1757185724047	org_01920000_1000_7000_8000_000000000001_testdocument1757185724047	document	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false, "fieldSetRef": "document-status"}, {"name": "category", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}], "archetype": "document", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "document", "serverOnly": false, "fieldSetRef": "document-status"}, {"name": "category", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "document", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:44.139	2025-09-06 21:19:07.816	t	2025-09-06 21:19:07.816
01920000-1000-7000-8000-000000000001	Testrecord1757185724889	org_01920000_1000_7000_8000_000000000001_testrecord1757185724889	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "custom_text", "type": "text", "source": "custom", "required": false, "defaultValue": "test"}, {"name": "custom_number", "type": "number", "source": "custom", "required": false, "defaultValue": 42}, {"name": "custom_boolean", "type": "boolean", "source": "custom", "required": false, "defaultValue": true}, {"name": "custom_date", "type": "date", "source": "custom", "required": false}, {"name": "custom_json", "type": "json", "source": "custom", "required": false, "defaultValue": {"key": "value"}}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": [{"name": "custom_text", "type": "text", "source": "custom", "required": false, "defaultValue": "test"}, {"name": "custom_number", "type": "number", "source": "custom", "required": false, "defaultValue": 42}, {"name": "custom_boolean", "type": "boolean", "source": "custom", "required": false, "defaultValue": true}, {"name": "custom_date", "type": "date", "source": "custom", "required": false}, {"name": "custom_json", "type": "json", "source": "custom", "required": false, "defaultValue": {"key": "value"}}]}	2025-09-06 19:08:44.972	2025-09-06 21:19:08.387	t	2025-09-06 21:19:08.387
01920000-1000-7000-8000-000000000001	SecurityBadge	org_01920000_1000_7000_8000_000000000001_security_badge	record	{}	2025-09-06 07:57:06.104	2025-09-07 16:35:14.069	t	2025-09-07 16:35:14.069
01920000-1000-7000-8000-000000000001	Task	org_01920000_1000_7000_8000_000000000001_task	task	{"fields": [{"name": "title", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "description", "type": "longtext", "required": false, "syncable": true, "serverOnly": false}, {"name": "priority", "type": "priority_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "medium"}, {"name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "todo"}, {"name": "assignee_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "reporter_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "due_date", "type": "datetime", "required": false, "syncable": true, "serverOnly": false}, {"name": "estimated_hours", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "actual_hours", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "task_type", "type": "category_option", "required": false, "syncable": true, "serverOnly": false, "defaultValue": "feature"}, {"name": "parent_task_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "sprint_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "story_points", "type": "integer", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "description": "Entity metadata generated for Task task archetype"}	2025-08-23 19:18:06.831	2025-08-23 19:18:06.831	f	\N
01920000-1000-7000-8000-000000000001	Replicatestentity1757175687	org_01920000_1000_7000_8000_000000000001_replicatestentity1757175687	record	"{\\"version\\":\\"2.0\\",\\"allFields\\":[{\\"name\\":\\"name\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"description\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"record_type\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"enum\\":[\\"active\\",\\"inactive\\",\\"archived\\",\\"draft\\"],\\"name\\":\\"status\\",\\"type\\":\\"status_option\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false,\\"defaultValue\\":\\"active\\"},{\\"name\\":\\"data\\",\\"type\\":\\"json\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"parent_record_id\\",\\"type\\":\\"entity_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"owner_id\\",\\"type\\":\\"user_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"test_field\\",\\"type\\":\\"text\\",\\"source\\":\\"custom\\",\\"required\\":false},{\\"name\\":\\"test_number\\",\\"type\\":\\"number\\",\\"source\\":\\"custom\\",\\"defaultValue\\":0}],\\"archetype\\":\\"record\\",\\"baseFields\\":[{\\"name\\":\\"name\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"description\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"record_type\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"enum\\":[\\"active\\",\\"inactive\\",\\"archived\\",\\"draft\\"],\\"name\\":\\"status\\",\\"type\\":\\"status_option\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false,\\"defaultValue\\":\\"active\\"},{\\"name\\":\\"data\\",\\"type\\":\\"json\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"parent_record_id\\",\\"type\\":\\"entity_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"owner_id\\",\\"type\\":\\"user_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false}],\\"customFields\\":[{\\"name\\":\\"test_field\\",\\"type\\":\\"text\\",\\"source\\":\\"column\\",\\"required\\":false,\\"migrated\\":true,\\"migratedAt\\":\\"2025-09-07T02:32:42.013Z\\"},{\\"name\\":\\"test_number\\",\\"type\\":\\"number\\",\\"source\\":\\"column\\",\\"defaultValue\\":0,\\"migrated\\":true,\\"migratedAt\\":\\"2025-09-07T02:32:42.013Z\\"}]}"	2025-09-06 16:21:27.773	2025-09-07 16:35:14.064	t	2025-09-07 16:35:14.064
01920000-1000-7000-8000-000000000001	TeamTask	org_01920000_1000_7000_8000_000000000001_teamtask	task	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "team_name", "type": "text", "source": "custom", "required": true}, {"name": "sprint_number", "type": "number", "source": "custom", "defaultValue": 1}], "archetype": "task", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "customFields": [{"name": "team_name", "type": "text", "source": "custom", "required": true}, {"name": "sprint_number", "type": "number", "source": "custom", "defaultValue": 1}]}	2025-09-07 12:24:26.825	2025-09-07 16:35:14.075	t	2025-09-07 16:35:14.075
01920000-1000-7000-8000-000000000001	Testdiscussion1757185633908	org_01920000_1000_7000_8000_000000000001_testdiscussion1757185633908	discussion	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false, "fieldSetRef": "discussion-status"}, {"enum": ["question", "announcement", "feedback", "general"], "name": "discussion_type", "type": "discussion_type_option", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false, "defaultValue": "general"}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "parent_discussion_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}], "archetype": "discussion", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false, "fieldSetRef": "discussion-status"}, {"enum": ["question", "announcement", "feedback", "general"], "name": "discussion_type", "type": "discussion_type_option", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false, "defaultValue": "general"}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "parent_discussion_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:13.979	2025-09-06 21:19:08.971	t	2025-09-06 21:19:08.971
01920000-1000-7000-8000-000000000001	Testfile1757185635467	org_01920000_1000_7000_8000_000000000001_testfile1757185635467	file	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "file_path", "type": "text", "source": "archetype", "required": true, "syncable": false, "archetype": "file", "serverOnly": true}, {"name": "mime_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "size_bytes", "type": "integer", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false, "fieldSetRef": "file-status"}, {"name": "uploaded_by", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "file", "serverOnly": false}], "archetype": "file", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "file_path", "type": "text", "source": "archetype", "required": true, "syncable": false, "archetype": "file", "serverOnly": true}, {"name": "mime_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "size_bytes", "type": "integer", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false, "fieldSetRef": "file-status"}, {"name": "uploaded_by", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "file", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:15.593	2025-09-06 21:19:09.549	t	2025-09-06 21:19:09.549
01920000-1000-7000-8000-000000000001	Testfile1757185724220	org_01920000_1000_7000_8000_000000000001_testfile1757185724220	file	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "file_path", "type": "text", "source": "archetype", "required": true, "syncable": false, "archetype": "file", "serverOnly": true}, {"name": "mime_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "size_bytes", "type": "integer", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false, "fieldSetRef": "file-status"}, {"name": "uploaded_by", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "file", "serverOnly": false}], "archetype": "file", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "file_path", "type": "text", "source": "archetype", "required": true, "syncable": false, "archetype": "file", "serverOnly": true}, {"name": "mime_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "size_bytes", "type": "integer", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "file", "serverOnly": false, "fieldSetRef": "file-status"}, {"name": "uploaded_by", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "file", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:44.303	2025-09-06 21:19:10.127	t	2025-09-06 21:19:10.127
56389312-ddb8-4143-8061-d8a357ebca0c	MorningWorkout	org_01920000_1000_7000_8000_000000000001_morningworkouts	project	{}	2025-08-31 13:50:47.733	2025-08-31 13:50:47.733	f	\N
01920000-1000-7000-8000-000000000001	Testduplicate1757185725048	org_01920000_1000_7000_8000_000000000001_testduplicate1757185725048	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:45.127	2025-09-06 21:19:10.697	t	2025-09-06 21:19:10.697
01920000-1000-7000-8000-000000000001	File	org_01920000_1000_7000_8000_000000000001_file	file	{"fields": [{"name": "name", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "file_path", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "mime_type", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "size_bytes", "type": "integer", "required": true, "syncable": true, "serverOnly": false}, {"name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "active"}, {"name": "uploaded_by", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "description": "Entity metadata generated for File file archetype"}	2025-08-23 19:18:34.026	2025-09-07 16:35:14.088	t	2025-09-07 16:35:14.088
01920000-1000-7000-8000-000000000001	TestProduct	org_01920000_1000_7000_8000_000000000001_testproduct	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "sku", "type": "text", "source": "custom", "required": true}, {"name": "price", "type": "decimal", "source": "custom", "defaultValue": 0}], "archetype": "record", "tableName": "org_01920000_1000_7000_8000_000000000001_testproduct", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": [{"name": "sku", "type": "text", "source": "custom", "required": true}, {"name": "price", "type": "decimal", "source": "custom", "defaultValue": 0}]}	2025-09-07 15:03:27.143	2025-09-07 16:35:14.092	t	2025-09-07 16:35:14.092
01920000-1000-7000-8000-000000000001	Reptest76123	org_01920000_1000_7000_8000_000000000001_reptest76123	record	"{\\"version\\":\\"2.0\\",\\"allFields\\":[{\\"name\\":\\"name\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"description\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"record_type\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"enum\\":[\\"active\\",\\"inactive\\",\\"archived\\",\\"draft\\"],\\"name\\":\\"status\\",\\"type\\":\\"status_option\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false,\\"defaultValue\\":\\"active\\"},{\\"name\\":\\"data\\",\\"type\\":\\"json\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"parent_record_id\\",\\"type\\":\\"entity_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"owner_id\\",\\"type\\":\\"user_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"test_field\\",\\"type\\":\\"text\\",\\"source\\":\\"custom\\",\\"required\\":false},{\\"name\\":\\"test_number\\",\\"type\\":\\"number\\",\\"source\\":\\"custom\\",\\"defaultValue\\":0}],\\"archetype\\":\\"record\\",\\"baseFields\\":[{\\"name\\":\\"name\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"description\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"record_type\\",\\"type\\":\\"text\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"enum\\":[\\"active\\",\\"inactive\\",\\"archived\\",\\"draft\\"],\\"name\\":\\"status\\",\\"type\\":\\"status_option\\",\\"source\\":\\"archetype\\",\\"required\\":true,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false,\\"defaultValue\\":\\"active\\"},{\\"name\\":\\"data\\",\\"type\\":\\"json\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"parent_record_id\\",\\"type\\":\\"entity_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false},{\\"name\\":\\"owner_id\\",\\"type\\":\\"user_reference\\",\\"source\\":\\"archetype\\",\\"required\\":false,\\"syncable\\":true,\\"archetype\\":\\"record\\",\\"serverOnly\\":false}],\\"customFields\\":[{\\"name\\":\\"test_field\\",\\"type\\":\\"text\\",\\"source\\":\\"column\\",\\"required\\":false,\\"migrated\\":true,\\"migratedAt\\":\\"2025-09-07T02:32:42.046Z\\"},{\\"name\\":\\"test_number\\",\\"type\\":\\"number\\",\\"source\\":\\"column\\",\\"defaultValue\\":0,\\"migrated\\":true,\\"migratedAt\\":\\"2025-09-07T02:32:42.046Z\\"}]}"	2025-09-06 16:28:43.8	2025-09-07 16:35:14.079	t	2025-09-07 16:35:14.079
01920000-1000-7000-8000-000000000001	AccessControlList	org_01920000_1000_7000_8000_000000000001_access_control_list	record	{}	2025-09-06 07:57:27.032	2025-09-07 16:35:14.083	t	2025-09-07 16:35:14.083
01920000-1000-7000-8000-000000000001	Testproject1757185632812	org_01920000_1000_7000_8000_000000000001_testproject1757185632812	project	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-status"}, {"name": "start_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "end_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "budget", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false, "defaultValue": 0}], "archetype": "project", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-status"}, {"name": "start_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "end_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "budget", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false, "defaultValue": 0}], "customFields": []}	2025-09-06 19:07:12.972	2025-09-06 21:19:11.268	t	2025-09-06 21:19:11.268
01920000-1000-7000-8000-000000000001	Customerorder	org_01920000_1000_7000_8000_000000000001_customerorder	task	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"enum": ["low", "medium", "high", "critical"], "name": "priority", "type": "priority_option", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "defaultValue": "medium"}, {"enum": ["todo", "in_progress", "review", "blocked", "completed", "cancelled"], "name": "status", "type": "status_option", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "defaultValue": "todo"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "reporter_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "estimated_hours", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "actual_hours", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"enum": ["bug", "feature", "improvement", "documentation", "maintenance"], "name": "task_type", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false, "defaultValue": "feature"}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "sprint_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "story_points", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "customer_name", "type": "text", "source": "custom", "required": true}, {"name": "order_total", "type": "decimal", "source": "custom", "required": true, "defaultValue": 0}], "archetype": "task", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"enum": ["low", "medium", "high", "critical"], "name": "priority", "type": "priority_option", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "defaultValue": "medium"}, {"enum": ["todo", "in_progress", "review", "blocked", "completed", "cancelled"], "name": "status", "type": "status_option", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "defaultValue": "todo"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "reporter_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "estimated_hours", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "actual_hours", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"enum": ["bug", "feature", "improvement", "documentation", "maintenance"], "name": "task_type", "type": "category_option", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false, "defaultValue": "feature"}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "sprint_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "story_points", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "customFields": [{"name": "customer_name", "type": "text", "source": "custom", "required": true}, {"name": "order_total", "type": "decimal", "source": "custom", "required": true, "defaultValue": 0}]}	2025-09-06 14:42:16.875	2025-09-06 14:53:51.195	t	2025-09-06 14:53:51.195
01920000-1000-7000-8000-000000000001	Discussion	org_01920000_1000_7000_8000_000000000001_discussion	discussion	{"fields": [{"name": "title", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "content", "type": "rich_text", "required": false, "syncable": true, "serverOnly": false}, {"name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "open"}, {"name": "discussion_type", "type": "discussion_type_option", "required": false, "syncable": true, "serverOnly": false, "defaultValue": "general"}, {"name": "author_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "parent_discussion_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "description": "Entity metadata generated for Discussion discussion archetype"}	2025-08-23 19:18:47.371	2025-08-23 19:18:47.371	f	\N
01920000-1000-7000-8000-000000000001	Testactivity1757185635676	org_01920000_1000_7000_8000_000000000001_testactivity1757185635676	activity	{"version": "2.0", "allFields": [{"name": "activity_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_type", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_id", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "metadata", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}], "archetype": "activity", "baseFields": [{"name": "activity_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_type", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_id", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "metadata", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:15.752	2025-09-06 21:19:12.399	t	2025-09-06 21:19:12.399
01920000-1000-7000-8000-000000000001	Testactivity1757185724376	org_01920000_1000_7000_8000_000000000001_testactivity1757185724376	activity	{"version": "2.0", "allFields": [{"name": "activity_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_type", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_id", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "metadata", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}], "archetype": "activity", "baseFields": [{"name": "activity_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_type", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "entity_id", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}, {"name": "metadata", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "activity", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:44.458	2025-09-06 21:19:12.979	t	2025-09-06 21:19:12.979
01920000-1000-7000-8000-000000000001	Testtask1757185725218	org_01920000_1000_7000_8000_000000000001_testtask1757185725218	task	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "archetype": "task", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "task", "serverOnly": false, "fieldSetRef": "task-status"}, {"name": "assignee_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "due_date", "type": "datetime", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "parent_task_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}, {"name": "project_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "task", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:45.289	2025-09-06 21:19:13.55	t	2025-09-06 21:19:13.55
01920000-1000-7000-8000-000000000001	UserPermissionGroup	org_01920000_1000_7000_8000_000000000001_user_permission_group	record	{}	2025-09-06 07:58:53.311	2025-09-07 16:35:14.096	t	2025-09-07 16:35:14.096
01920000-1000-7000-8000-000000000001	Testrecord1757185634236	org_01920000_1000_7000_8000_000000000001_testrecord1757185634236	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "custom_text", "type": "text", "source": "custom", "required": false, "defaultValue": "test"}, {"name": "custom_number", "type": "number", "source": "custom", "required": false, "defaultValue": 42}, {"name": "custom_boolean", "type": "boolean", "source": "custom", "required": false, "defaultValue": true}, {"name": "custom_date", "type": "date", "source": "custom", "required": false}, {"name": "custom_json", "type": "json", "source": "custom", "required": false, "defaultValue": {"key": "value"}}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": [{"name": "custom_text", "type": "text", "source": "custom", "required": false, "defaultValue": "test"}, {"name": "custom_number", "type": "number", "source": "custom", "required": false, "defaultValue": 42}, {"name": "custom_boolean", "type": "boolean", "source": "custom", "required": false, "defaultValue": true}, {"name": "custom_date", "type": "date", "source": "custom", "required": false}, {"name": "custom_json", "type": "json", "source": "custom", "required": false, "defaultValue": {"key": "value"}}]}	2025-09-06 19:07:14.324	2025-09-06 21:19:14.693	t	2025-09-06 21:19:14.693
01920000-1000-7000-8000-000000000001	Productcatalog	org_01920000_1000_7000_8000_000000000001_productcatalog	collection	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "collection_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "items", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false, "defaultValue": []}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "product_code", "type": "text", "source": "custom", "required": true}, {"name": "unit_price", "type": "decimal", "source": "custom", "required": true, "defaultValue": 0}], "archetype": "collection", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "collection_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "collection", "serverOnly": false}, {"name": "items", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false, "defaultValue": []}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "collection", "serverOnly": false}], "customFields": [{"name": "product_code", "type": "text", "source": "custom", "required": true}, {"name": "unit_price", "type": "decimal", "source": "custom", "required": true, "defaultValue": 0}]}	2025-09-06 14:47:08.943	2025-09-06 14:53:35.099	t	2025-09-06 14:53:35.099
01920000-1000-7000-8000-000000000001	TestManualEntity	org_01920000_1000_7000_8000_000000000001_testmanualentity	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:31.382	2025-09-06 21:19:15.268	t	2025-09-06 21:19:15.268
01920000-1000-7000-8000-000000000001	Testdiscussion1757185724556	org_01920000_1000_7000_8000_000000000001_testdiscussion1757185724556	discussion	{"version": "2.0", "allFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false, "fieldSetRef": "discussion-status"}, {"enum": ["question", "announcement", "feedback", "general"], "name": "discussion_type", "type": "discussion_type_option", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false, "defaultValue": "general"}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "parent_discussion_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}], "archetype": "discussion", "baseFields": [{"name": "title", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "content", "type": "rich_text", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "discussion", "serverOnly": false, "fieldSetRef": "discussion-status"}, {"enum": ["question", "announcement", "feedback", "general"], "name": "discussion_type", "type": "discussion_type_option", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false, "defaultValue": "general"}, {"name": "author_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}, {"name": "parent_discussion_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "discussion", "serverOnly": false}], "customFields": []}	2025-09-06 19:08:44.624	2025-09-06 21:19:15.838	t	2025-09-06 21:19:15.838
01920000-1000-7000-8000-000000000001	TestDebugEntity	org_01920000_1000_7000_8000_000000000001_testdebugentity	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:09:06.972	2025-09-06 21:19:16.409	t	2025-09-06 21:19:16.409
01920000-1000-7000-8000-000000000001	Contract	org_01920000_1000_7000_8000_000000000001_contract	project	{"fields": [{"name": "name", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "description", "type": "longtext", "required": false, "syncable": true, "serverOnly": false}, {"enum": ["low", "medium", "high", "critical"], "name": "priority", "type": "priority_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "medium"}, {"enum": ["planning", "active", "on_hold", "completed", "cancelled"], "name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "planning"}, {"name": "start_date", "type": "date", "required": false, "syncable": true, "serverOnly": false}, {"name": "end_date", "type": "date", "required": false, "syncable": true, "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "budget", "type": "decimal", "required": false, "syncable": true, "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "required": false, "syncable": true, "serverOnly": false, "defaultValue": 0}, {"enum": ["software", "research", "marketing", "operational", "strategic"], "name": "project_type", "type": "category_option", "required": false, "syncable": true, "serverOnly": false, "defaultValue": "operational"}, {"name": "value", "type": "decimal", "required": false, "syncable": true, "serverOnly": false}, {"name": "contract_type", "type": "text", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "createdAt": "2025-08-23T11:31:54.141Z", "description": "Entity created via DataForge API"}	2025-08-23 11:31:54.366294	2025-08-23 11:31:54.366294	f	\N
01920000-1000-7000-8000-000000000001	Project	org_01920000_1000_7000_8000_000000000001_project	project	{"fields": [{"name": "name", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "description", "type": "longtext", "required": false, "syncable": true, "serverOnly": false}, {"enum": ["low", "medium", "high", "critical"], "name": "priority", "type": "priority_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "medium"}, {"enum": ["planning", "active", "on_hold", "completed", "cancelled"], "name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "planning"}, {"name": "start_date", "type": "date", "required": false, "syncable": true, "serverOnly": false}, {"name": "end_date", "type": "date", "required": false, "syncable": true, "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "budget", "type": "decimal", "required": false, "syncable": true, "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "required": false, "syncable": true, "serverOnly": false, "defaultValue": 0}, {"enum": ["software", "research", "marketing", "operational", "strategic"], "name": "project_type", "type": "category_option", "required": false, "syncable": true, "serverOnly": false, "defaultValue": "operational"}], "syncable": true, "createdAt": "2025-08-23T11:31:03.441Z", "description": "Entity created via DataForge API"}	2025-08-23 11:31:03.67031	2025-08-23 11:31:03.67031	f	\N
01920000-1000-7000-8000-000000000001	DataAnalyticsReport	org_01920000_1000_7000_8000_000000000001_data_analytics_report	record	{}	2025-09-06 07:59:03.304	2025-09-07 16:35:14.1	t	2025-09-07 16:35:14.1
01920000-1000-7000-8000-000000000001	Client	org_01920000_1000_7000_8000_000000000001_client	record	{"fields": [{"name": "name", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "description", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "record_type", "type": "select", "source": "custom", "cellType": "select", "required": false, "syncable": true, "serverOnly": false, "enumOptions": [{"color": "#10B981", "label": "Individual", "value": "individual"}, {"color": "#3B82F6", "label": "Company", "value": "company"}, {"color": "#8B5CF6", "label": "Organization", "value": "organization"}, {"color": "#F59E0B", "label": "Prospect", "value": "prospect"}, {"color": "#EF4444", "label": "Lead", "value": "lead"}, {"color": "#06B6D4", "label": "Partner", "value": "partner"}, {"color": "#84CC16", "label": "Vendor", "value": "vendor"}], "defaultValue": "company"}, {"name": "status", "type": "select", "cellType": "select", "required": true, "syncable": true, "serverOnly": false, "enumOptions": [{"color": "#10B981", "label": "Active", "value": "active"}, {"color": "#6B7280", "label": "Inactive", "value": "inactive"}, {"color": "#F59E0B", "label": "Pending", "value": "pending"}, {"color": "#8B5CF6", "label": "On Hold", "value": "on_hold"}, {"color": "#6B7280", "label": "Archived", "value": "archived"}, {"color": "#EF4444", "label": "Deleted", "value": "deleted"}], "defaultValue": "active"}, {"name": "data", "type": "json", "required": false, "syncable": true, "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "email", "type": "email", "required": false, "syncable": true, "serverOnly": false}, {"name": "phone", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "industry", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "company_name", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "contact_person", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "priority", "type": "select", "cellType": "select", "required": false, "syncable": true, "serverOnly": false, "enumOptions": [{"color": "#10B981", "label": "Low", "value": "low"}, {"color": "#F59E0B", "label": "Medium", "value": "medium"}, {"color": "#F97316", "label": "High", "value": "high"}, {"color": "#EF4444", "label": "Critical", "value": "critical"}], "defaultValue": "medium"}], "syncable": true, "createdAt": "2025-08-23T11:30:51.488Z", "description": "Entity created via DataForge API"}	2025-08-23 11:30:51.794527	2025-08-25 18:54:12.976342	f	\N
01920000-1000-7000-8000-000000000001	Expense	org_01920000_1000_7000_8000_000000000001_expense	document	{"fields": [{"name": "title", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "content", "type": "rich_text", "required": false, "syncable": true, "serverOnly": false}, {"enum": ["draft", "review", "published", "archived"], "name": "status", "type": "status_option", "required": true, "syncable": true, "serverOnly": false, "defaultValue": "draft"}, {"name": "category", "type": "category_option", "required": false, "syncable": true, "serverOnly": false}, {"name": "author_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "parent_document_id", "type": "entity_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "amount", "type": "decimal", "required": true, "syncable": true, "serverOnly": false}, {"name": "expense_type", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "receipt_url", "type": "url", "required": false, "syncable": true, "serverOnly": false}, {"name": "reimbursable", "type": "boolean", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "createdAt": "2025-08-23T11:32:06.354Z", "description": "Entity created via DataForge API"}	2025-08-23 11:32:06.593347	2025-08-23 11:32:06.593347	f	\N
01920000-1000-7000-8000-000000000001	Meeting	org_01920000_1000_7000_8000_000000000001_meeting	activity	{"fields": [{"name": "activity_type", "type": "text", "required": true, "syncable": true, "serverOnly": false}, {"name": "description", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "entity_type", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "entity_id", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "actor_id", "type": "user_reference", "required": false, "syncable": true, "serverOnly": false}, {"name": "metadata", "type": "json", "required": false, "syncable": true, "serverOnly": false}, {"name": "duration", "type": "decimal", "required": false, "syncable": true, "serverOnly": false}, {"name": "location", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "attendees", "type": "text", "required": false, "syncable": true, "serverOnly": false}, {"name": "meeting_type", "type": "text", "required": false, "syncable": true, "serverOnly": false}], "syncable": true, "createdAt": "2025-08-23T11:32:18.343Z", "description": "Entity created via DataForge API"}	2025-08-23 11:32:18.572973	2025-08-23 11:32:18.572973	f	\N
01920000-1000-7000-8000-000000000001	Testrecord1757185633236	org_01920000_1000_7000_8000_000000000001_testrecord1757185633236	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:13.304	2025-09-06 21:19:16.996	t	2025-09-06 21:19:16.996
01920000-1000-7000-8000-000000000001	Testduplicate1757185634420	org_01920000_1000_7000_8000_000000000001_testduplicate1757185634420	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:07:14.521	2025-09-06 21:19:17.579	t	2025-09-06 21:19:17.579
01920000-1000-7000-8000-000000000001	Testproject1757185723329	org_01920000_1000_7000_8000_000000000001_testproject1757185723329	project	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-status"}, {"name": "start_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "end_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "budget", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false, "defaultValue": 0}], "archetype": "project", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-status"}, {"name": "start_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "end_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "budget", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false, "defaultValue": 0}], "customFields": []}	2025-09-06 19:08:43.426	2025-09-06 21:19:18.154	t	2025-09-06 21:19:18.154
01920000-1000-7000-8000-000000000001	TestProjectDebug	org_01920000_1000_7000_8000_000000000001_testprojectdebug	project	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-status"}, {"name": "start_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "end_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "budget", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false, "defaultValue": 0}], "archetype": "project", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "description", "type": "longtext", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "priority", "type": "priority_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-priority"}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "project", "serverOnly": false, "fieldSetRef": "project-status"}, {"name": "start_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "end_date", "type": "date", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "budget", "type": "decimal", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false}, {"name": "progress_percentage", "type": "integer", "source": "archetype", "required": false, "syncable": true, "archetype": "project", "serverOnly": false, "defaultValue": 0}], "customFields": []}	2025-09-06 19:09:42.14	2025-09-06 21:19:18.73	t	2025-09-06 21:19:18.73
01920000-1000-7000-8000-000000000001	InventoryItem	org_01920000_1000_7000_8000_000000000001_inventoryitem	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "record_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"enum": ["active", "inactive", "archived", "draft"], "name": "status", "type": "status_option", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "defaultValue": "active"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "sku", "type": "text", "source": "custom", "required": true}, {"name": "quantity", "type": "integer", "source": "custom", "required": true, "defaultValue": 0}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "record_type", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"enum": ["active", "inactive", "archived", "draft"], "name": "status", "type": "status_option", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "defaultValue": "active"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": [{"name": "sku", "type": "text", "source": "custom", "required": true}, {"name": "quantity", "type": "integer", "source": "custom", "required": true, "defaultValue": 0}]}	2025-09-06 14:48:32.152	2025-09-07 16:35:14.104	t	2025-09-07 16:35:14.104
01920000-1000-7000-8000-000000000001	TestDuplicate1757186002154	org_01920000_1000_7000_8000_000000000001_testduplicate1757186002154	record	{"version": "2.0", "allFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "archetype": "record", "baseFields": [{"name": "name", "type": "text", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "description", "type": "text", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "status", "type": "status_set", "source": "archetype", "required": true, "syncable": true, "archetype": "record", "serverOnly": false, "fieldSetRef": "record-status"}, {"name": "data", "type": "json", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "parent_record_id", "type": "entity_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}, {"name": "owner_id", "type": "user_reference", "source": "archetype", "required": false, "syncable": true, "archetype": "record", "serverOnly": false}], "customFields": []}	2025-09-06 19:13:22.232	2025-09-06 21:19:19.313	t	2025-09-06 21:19:19.313
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, slug, created_at, updated_at, settings, type, owner_user_id, auto_created, lore, canon, subscription_tier, subscription_status, billing_cycle, billing_email, trial_ends_at, billing_settings) FROM stdin;
108b0ac2-487f-4951-b295-b1924288daad	TechFlow Solutions	techflow-solutions	2025-08-15 21:35:08.904915+00	2025-09-02 19:45:40.83641+00	{}	business	\N	f	Creating value and impact through collaborative work and meaningful relationships	["Respect and inclusion", "Collaborative decision making", "Quality deliverables", "Open communication"]	trial	active	monthly	\N	\N	{}
01920000-2000-7000-8000-000000000002	Polymorphic Test CRM	polymorphic-test	2025-08-16 00:48:20.207914+00	2025-09-02 19:45:40.83641+00	{"industry": "SaaS", "timezone": "America/Los_Angeles", "company_size": "51-200", "sync_options": {"enable_polymorphic": true, "enable_system_options": true, "enable_custom_filtering": true}}	business	\N	f	Creating value and impact through collaborative work and meaningful relationships	["Respect and inclusion", "Collaborative decision making", "Quality deliverables", "Open communication"]	trial	active	monthly	\N	\N	{}
1c3ef67a-2051-46b4-b54a-dd0f2c0b6db4	Playwright Test Organization	playwright-test-organization	2025-08-16 13:05:46.993884+00	2025-09-02 19:45:40.83641+00	{"country": null, "industry": null, "logo_url": null, "timezone": "UTC", "description": null, "website_url": null, "company_size": null, "billing_email": null, "trial_ends_at": "2025-08-30T13:05:46.730Z", "allowed_domains": ["playwright-test.com"], "trial_started_at": "2025-08-16T13:05:46.730Z", "subscription_tier": "trial"}	business	\N	f	Creating value and impact through collaborative work and meaningful relationships	["Respect and inclusion", "Collaborative decision making", "Quality deliverables", "Open communication"]	trial	active	monthly	\N	\N	{}
01920000-1000-7000-8000-000000000001	Wide Corp Solutions	wide-corp	2025-08-16 00:28:03.818317+00	2025-09-09 00:02:20.815044+00	{"industry": "Software Consulting", "timezone": "America/New_York", "company_size": "11-50"}	business	\N	f	Building innovative solutions for enterprise clients while maintaining work-life balance and continuous learning	["Quality over speed", "Customer success first", "Transparent communication", "Continuous learning"]	pro	active	annual	\N	\N	{}
0a1eaf20-5386-43e8-ad36-73fafefeb500	Playwright Test Organization 1755349777432	playwright-test-organization-1755349777432	2025-08-16 13:09:39.369872+00	2025-09-02 19:45:40.83641+00	{"country": null, "industry": null, "logo_url": null, "timezone": "UTC", "description": null, "website_url": null, "company_size": null, "billing_email": null, "trial_ends_at": "2025-08-30T13:09:38.932Z", "allowed_domains": ["playwright-test-1755349777432.com"], "trial_started_at": "2025-08-16T13:09:38.932Z", "subscription_tier": "trial"}	business	\N	f	Creating value and impact through collaborative work and meaningful relationships	["Respect and inclusion", "Collaborative decision making", "Quality deliverables", "Open communication"]	trial	active	monthly	\N	\N	{}
72622cf0-b4c6-4f15-890f-e0b9f695fcdb	Test Member's Personal Workspace	personal-0198d836-58b6-7590-b715-8974f2033b0a	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198d836-58b6-7590-b715-8974f2033b0a	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
665049a7-dfed-4f01-8180-41202efaba3a	Gary Guest's Personal Workspace	personal-0198d872-3eda-781e-910f-e8d109fbb967	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198d872-3eda-781e-910f-e8d109fbb967	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
4dd6b20a-aa87-4e43-a52d-7c42856d725e	New Test User's Personal Workspace	personal-0198f65b-d657-7440-a635-5b59be41b835	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198f65b-d657-7440-a635-5b59be41b835	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
0031029c-9915-4de2-9179-ffbb159057f1	TechFlow Admin's Personal Workspace	personal-0198aed6-cc0b-783b-b414-c5fb8a81f227	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198aed6-cc0b-783b-b414-c5fb8a81f227	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
bddd93de-7a65-444a-88e1-0ea0334d012a	Jim Member's Personal Workspace	personal-0198d86e-2544-71f8-8188-026e43f726c6	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198d86e-2544-71f8-8188-026e43f726c6	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
ef1f96f1-cfab-478b-96e1-159fcdc02bb7	Carol PM's Personal Workspace	personal-0198b046-d931-7772-a1e8-b63c68c7f43d	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-d931-7772-a1e8-b63c68c7f43d	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
ec09e01f-1b70-44bd-85c1-79ee7bfb3cbe	David PM's Personal Workspace	personal-0198b046-e16b-7b46-a15e-baa49fd29990	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-e16b-7b46-a15e-baa49fd29990	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
a5e17f31-827c-466d-a5f6-44480a0d9a26	Eve Developer's Personal Workspace	personal-0198b046-e873-7739-bac2-10db9440486b	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-e873-7739-bac2-10db9440486b	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
caf9988b-d2ef-43de-82b7-580833bd1b84	Frank Developer's Personal Workspace	personal-0198b046-f056-7735-a3aa-60e8a329dd23	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-f056-7735-a3aa-60e8a329dd23	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
07635be6-a99b-4569-bf72-ceda2e450323	Grace Designer's Personal Workspace	personal-0198b046-f71e-7bec-a853-294d7cbcbda5	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-f71e-7bec-a853-294d7cbcbda5	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
92d66d2b-726b-45f4-949e-25c29a0f8642	Henry Intern's Personal Workspace	personal-0198b046-fe7a-7855-b4d8-4408253dc9c5	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-fe7a-7855-b4d8-4408253dc9c5	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
24254bc5-5fdd-45f4-9694-f61a23a8562a	Playwright Test User's Personal Workspace	personal-0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
eeb713e6-e94a-435e-a66a-41443d8658bf	System Admin's Personal Workspace	personal-0198b059-5419-7165-b2c3-937a66b94865	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b059-5419-7165-b2c3-937a66b94865	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
1715c778-0ecd-4a3f-af5c-838ab51bbf0b	Sales Manager's Personal Workspace	personal-0198b059-5999-7f84-8217-0506a838e0da	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b059-5999-7f84-8217-0506a838e0da	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
fdb6bff8-e11e-4a98-a5f8-4a8531386701	Support Agent's Personal Workspace	personal-0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
8b525929-c8f5-4056-b343-1f85f70e34d2	Read Only User's Personal Workspace	personal-0198b059-64c9-7c4f-87be-5b1a3704f1c3	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b059-64c9-7c4f-87be-5b1a3704f1c3	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
75209771-bdad-4eda-96ab-fb14803668db	Kate Viewer's Personal Workspace	personal-0198d86e-3ed0-7bf2-9317-674ef372c7db	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198d86e-3ed0-7bf2-9317-674ef372c7db	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
81a82bbb-5544-4a9b-8215-5174887e224a	Bob CTO's Personal Workspace	personal-0198b046-d127-769d-9bc2-8e5824b71b3a	2025-09-01 11:54:37.693785+00	2025-09-02 19:45:40.83641+00	{}	personal	0198b046-d127-769d-9bc2-8e5824b71b3a	t	Managing personal life areas with intentionality, balance, and alignment with core values	["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]	trial	active	monthly	\N	\N	{}
0198b046-c453-72d9-b71a-092e1f75601a	Alice CEO's Personal Workspace	personal-alice-ceo	2025-09-06 18:28:51.609504+00	2025-09-06 18:28:51.609504+00	{}	personal	0198b046-c453-72d9-b71a-092e1f75601a	f	\N	[]	trial	active	monthly	\N	\N	{}
01992556-60c6-7a48-a54f-5348ded91e7e	Trial Test User's Personal Workspace	trial-test-user-1757268041926	2025-09-07 18:00:41.926+00	2025-09-07 18:00:41.926+00	{}	personal	\N	f	\N	[]	trial	active	monthly	\N	\N	{}
0199258e-2bcf-7ae6-bcf9-731159986320	E2E Test User 1757271685's Personal Workspace	e2e-test-user-1757271685-1757271698383	2025-09-07 19:01:38.383+00	2025-09-07 19:01:38.383+00	{}	personal	\N	f	\N	[]	trial	active	monthly	\N	\N	{}
0199258e-2d33-75db-9b3d-21d47aae6c2c	E2E Test Org 1757271685	e2e-test-org-1757271685	2025-09-07 19:01:38.739+00	2025-09-07 19:01:38.739+00	{}	business	\N	f	\N	[]	trial	trial	monthly	e2etest.1757271685@gmail.com	2025-09-21 19:01:38.739+00	{}
0199258e-e50a-7f60-8aad-64ca53ac3cf8	Fresh Test User 1757271732549's Personal Workspace	fresh-test-user-1757271732549-1757271745802	2025-09-07 19:02:25.802+00	2025-09-07 19:02:25.802+00	{}	personal	\N	f	\N	[]	trial	active	monthly	\N	\N	{}
0199258e-e6a0-7658-9e9b-809e686b04bc	Fresh Test Org 1757271732549	fresh-test-org-1757271732549	2025-09-07 19:02:26.208+00	2025-09-07 19:02:26.208+00	{}	business	\N	f	\N	[]	trial	trial	monthly	freshuser.1757271732549@gmail.com	2025-09-21 19:02:26.208+00	{}
0199258f-5dde-7dc0-bef9-4e11c293c8cd	Newest Test User 1757271767298's Personal Workspace	newest-test-user-1757271767298-1757271776734	2025-09-07 19:02:56.734+00	2025-09-07 19:02:56.734+00	{}	personal	\N	f	\N	[]	trial	active	monthly	\N	\N	{}
0199258f-5ef3-7d3f-9436-f506791cad07	Newest Test Org 1757271767298	newest-test-org-1757271767298	2025-09-07 19:02:57.011+00	2025-09-07 19:02:57.011+00	{}	business	\N	f	\N	[]	trial	trial	monthly	newest.1757271767298@gmail.com	2025-09-21 19:02:57.011+00	{}
01992590-a56f-760d-a90f-01f9750a7ab6	E2E Test User Final's Personal Workspace	e2e-test-user-final-1757271860591	2025-09-07 19:04:20.591+00	2025-09-07 19:04:20.591+00	{}	personal	\N	f	\N	[]	trial	active	monthly	\N	\N	{}
01992590-a6a2-7888-86e6-d4bf191ac1cf	E2E Final Test Organization	e2e-final-test-organization	2025-09-07 19:04:20.898+00	2025-09-07 21:32:39.420292+00	{}	business	\N	f	\N	[]	trial	trial	monthly	e2efinal.test@gmail.com	2025-09-06 21:32:39.420292+00	{}
\.


--
-- Data for Name: file_imports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.file_imports (id, org_id, file_name, file_type, file_size, file_path, file_hash, status, detected_columns, row_count, sample_data, target_entity, column_mappings, transformation_rules, import_mode, records_processed, records_imported, records_updated, records_failed, records_skipped, error_details, validation_errors, created_at, started_at, completed_at, created_by) FROM stdin;
019923ec-cfe6-707f-878e-11ac979094a2	0198b046-c453-72d9-b71a-092e1f75601a	test-upload.csv	csv	131	imports/0198b046-c453-72d9-b71a-092e1f75601a/019923ec-cfca-793f-82a2-982c50275073/test-upload.csv	7e5290580de9d1e8f843d3899d0079402e0b110e0df4c0ebb25cfcc3e6a555e8	uploaded	\N	\N	\N	\N	\N	\N	create	0	0	0	0	0	\N	\N	2025-09-07 11:25:46.343	\N	\N	demo-user-id
019923f8-1747-7dbe-9718-97f72ce7becb	0198b046-c453-72d9-b71a-092e1f75601a	test-upload.json	json	566	imports/0198b046-c453-72d9-b71a-092e1f75601a/019923f8-1736-7dc6-aa43-087478687e2b/test-upload.json	408f0ce42339dfb8013f16af168e7f1e2bce250da9add96ab6b6597fcc84dccb	uploaded	\N	\N	\N	\N	\N	\N	create	0	0	0	0	0	\N	\N	2025-09-07 11:38:05.512	\N	\N	demo-user-id
\.


--
-- Data for Name: import_errors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_errors (id, file_import_id, row_number, column_name, error_type, error_code, error_message, source_value, source_row_data, resolution_status, resolution_notes, resolved_at, resolved_by, created_at) FROM stdin;
\.


--
-- Data for Name: import_field_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_field_mappings (id, file_import_id, source_column, target_field, field_type, transformation_function, transformation_params, default_value, is_required, validation_rules, values_processed, values_transformed, validation_errors, created_at) FROM stdin;
\.


--
-- Data for Name: integration_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.integration_connections (id, org_id, provider, access_token, refresh_token, expires_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: import_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_mappings (id, org_id, connection_id, source_type, source_id, source_name, target_entity, field_mappings, transformation_rules, sync_enabled, sync_direction, last_sync_at, sync_status, sync_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: import_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_templates (id, org_id, name, description, file_type, target_entity, column_mappings, transformation_rules, import_mode, is_shared, is_public, usage_count, last_used_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_access_control_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_access_control_list (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_archetypetests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_archetypetests (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, priority) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_cachetestentitys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_cachetestentitys (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, reporter_id, due_date, estimated_hours, actual_hours, task_type, parent_task_id, project_id, sprint_id, story_points) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_capitol_building; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_capitol_building (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_cleantests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_cleantests (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, project_type, client) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_client (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, email, phone, industry, company_name, contact_person, new_test_field, another_new_field, score, category, notes, test_field, test_field_2, test_field_3, final_test_field, test_cache_refresh, priority) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_contract; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_contract (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, project_type, value, contract_type) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_customerorder; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_customerorder (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, reporter_id, due_date, estimated_hours, actual_hours, task_type, parent_task_id, project_id, sprint_id, story_points, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_data_analytics_report; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_data_analytics_report (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_discussion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_discussion (id, organization_id, created_by, created_at, updated_at, title, content, status, discussion_type, author_id, parent_discussion_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_emergency_contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_emergency_contact (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_expense; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_expense (id, organization_id, created_by, created_at, updated_at, title, content, status, category, author_id, parent_document_id, amount, expense_type, receipt_url, reimbursable) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_file; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_file (id, organization_id, created_by, created_at, updated_at, name, file_path, mime_type, size_bytes, status, uploaded_by) FROM stdin;
a56405a4-077c-447c-9ae0-b39a278c5273	01920000-1000-7000-8000-000000000001	\N	2025-08-23 19:18:40.994	2025-08-23 19:18:40.994	test-document.pdf	/uploads/test-document.pdf	application/pdf	12345	active	0198b046-c453-72d9-b71a-092e1f75601a
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_inventoryitem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_inventoryitem (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
02dcc1f7-c00c-4596-984d-741aa0f3b971	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-06 14:48:50.393	2025-09-06 14:48:50.393	Widget A	\N	product	active	\N	\N	\N	{"sku": "WGT-001", "quantity": 100}
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_invoice (id, organization_id, created_by, created_at, updated_at, title, content, status, category, author_id, parent_document_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_meeting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_meeting (id, organization_id, created_by, created_at, updated_at, activity_type, description, entity_type, entity_id, actor_id, metadata, duration, location, attendees, meeting_type) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_morningworkouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_morningworkouts (id, organization_id, created_by, created_at, updated_at, name, description, world_id, priority, status, start_date, end_date, owner_id, budget, progress_percentage, project_type) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_project; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_project (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, project_type) FROM stdin;
f95d1f22-1a38-4cf9-b76c-ba8414a8d278	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:09.621968+00	2025-09-07 16:51:09.621968+00	Website Redesign	Complete redesign of corporate website	high	active	2024-01-01	2024-06-30	12480000-0000-4000-8000-000000000001	50000.00	65	development
91b53611-befb-46b1-8e3f-6e23f561f82f	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:09.621968+00	2025-09-07 16:51:09.621968+00	Mobile App Development	Build iOS and Android apps	high	active	2024-02-01	2024-08-31	12480000-0000-4000-8000-000000000001	120000.00	40	development
a35ab90f-fbcc-4cd7-8b88-43067c2c4244	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:09.621968+00	2025-09-07 16:51:09.621968+00	Cloud Migration	Migrate infrastructure to AWS	medium	planning	2024-03-01	2024-09-30	12480000-0000-4000-8000-000000000001	80000.00	10	infrastructure
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_records (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, title) FROM stdin;
ddc61642-c77e-42c0-8a25-fa12962cfd6d	01920000-1000-7000-8000-000000000001	\N	2025-08-23 19:09:05.886	2025-08-23 19:09:05.886	Test Record - CEO Created	Testing record permissions with CEO role	record	active	\N	\N	\N	\N
01aa67c2-8980-41af-bf3f-9fd8dd343cb9	01920000-1000-7000-8000-000000000001	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-23 19:28:45.585	2025-08-23 19:28:45.585	Manager Record	Testing manager creating org-wide record	test	active	\N	\N	\N	\N
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_relationships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_relationships (id, source_entity_type, source_entity_id, relationship_type, relationship_subtype, target_entity_type, target_entity_id, properties, valid_from, valid_until, created_by, created_at, updated_by, updated_at) FROM stdin;
c8c251c6-f23a-4fa1-ac44-46000f8bba5c	Task	6f9458dd-0986-4abc-905c-0c3ac96de314	assigned_to	\N	User	0198b046-d931-7772-a1e8-b63c68c7f43d	{"role": "assignee", "migrated_from": "assignee_id"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
3ccb32d9-10e7-418d-b493-bb5662ed9e5b	Task	13b79f1e-74d1-44f5-9137-cc9683471c45	assigned_to	\N	User	0198b046-c453-72d9-b71a-092e1f75601a	{"role": "assignee", "migrated_from": "assignee_id"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
0130ca26-c97b-4884-a4f3-e2349cf9d8d8	Invoice	11e16936-e930-48f6-bebf-364abdc125dc	authored_by	\N	User	0198b046-c453-72d9-b71a-092e1f75601a	{"role": "primary_author", "migrated_from": "author_id"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
6d4c1596-12c0-46c5-83ad-72e81cbf620d	Discussion	bc711997-bfdb-496c-a68b-8ca2fc8bed7e	authored_by	\N	User	0198b046-c453-72d9-b71a-092e1f75601a	{"migrated_from": "author_id"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
a201aa12-6c9b-4a56-a467-c5b15bb4443d	User	0198b046-c453-72d9-b71a-092e1f75601a	member_of	\N	Project	dea1e46d-dcc8-4501-94ea-611de57def0d	{"role": "owner", "joined_date": "2024-01-01"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
adc0e073-b552-4225-bd90-e0db599e39f7	User	0198b046-ce51-7755-bbce-7e68a6d3f953	member_of	\N	Project	dea1e46d-dcc8-4501-94ea-611de57def0d	{"role": "tech_lead", "joined_date": "2024-01-02"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
6a3b4b02-d863-4527-8819-dd497cb71447	User	0198b046-d931-7772-a1e8-b63c68c7f43d	member_of	\N	Project	dea1e46d-dcc8-4501-94ea-611de57def0d	{"role": "member", "joined_date": "2024-01-03"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
a92242cf-78b9-44d5-b97e-edd2a37b84a1	Task	6f9458dd-0986-4abc-905c-0c3ac96de314	blocks	\N	Task	82840242-591a-4115-b230-417f3b9644de	{"reason": "Must complete API first", "severity": "critical"}	2025-09-07 11:27:42.422513	\N	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-09-07 11:27:42.422513	\N	\N
9c64ff07-4465-4214-b842-e48b22b41983	Task	82840242-591a-4115-b230-417f3b9644de	blocks	\N	Task	7a6df292-01eb-40b3-852d-36599b59d86e	{"reason": "Deployment dependency", "severity": "high"}	2025-09-07 11:27:42.422513	\N	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-09-07 11:27:42.422513	\N	\N
af6b3e7d-7f86-4583-bc93-eb963dd9df1b	User	0198b046-d931-7772-a1e8-b63c68c7f43d	reports_to	\N	User	0198b046-c453-72d9-b71a-092e1f75601a	{"since": "2024-01-01", "department": "Product"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
bdca4cc1-38f1-407e-976a-9dd2459a082d	User	0198b046-dadb-788a-8a65-e3f11ad45a75	reports_to	\N	User	0198b046-ce51-7755-bbce-7e68a6d3f953	{"since": "2024-01-01", "department": "Engineering"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
4995625e-2305-4dfc-9c1e-3da4e60d73f9	User	0198b046-ce51-7755-bbce-7e68a6d3f953	mentors	\N	User	0198b046-dadb-788a-8a65-e3f11ad45a75	{"started": "2024-02-01", "focus_areas": ["backend", "architecture"]}	2025-09-07 11:27:42.422513	\N	0198b046-ce51-7755-bbce-7e68a6d3f953	2025-09-07 11:27:42.422513	\N	\N
db5e8205-a1b6-4ff0-b196-1fa9cbb2231c	User	0198b046-ce51-7755-bbce-7e68a6d3f953	collaborates_with	\N	User	0198b046-d931-7772-a1e8-b63c68c7f43d	{"projects": ["API Design", "Architecture"], "strength": "high"}	2025-09-07 11:27:42.422513	\N	0198b046-ce51-7755-bbce-7e68a6d3f953	2025-09-07 11:27:42.422513	\N	\N
7264bf4e-b213-43c7-8c6a-d801ecc1038c	User	0198b046-c453-72d9-b71a-092e1f75601a	watching	\N	Task	82840242-591a-4115-b230-417f3b9644de	{"reason": "critical_priority", "notifications": true}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
25a2b9ec-1701-422d-bd09-62aa33094ea0	User	0198b046-ce51-7755-bbce-7e68a6d3f953	watching	\N	Task	82840242-591a-4115-b230-417f3b9644de	{"reason": "technical_oversight", "notifications": false}	2025-09-07 11:27:42.422513	\N	0198b046-ce51-7755-bbce-7e68a6d3f953	2025-09-07 11:27:42.422513	\N	\N
764b26c2-80bf-44ee-b14a-3d257278625f	User	0198b046-c453-72d9-b71a-092e1f75601a	stakeholder_in	\N	Project	dea1e46d-dcc8-4501-94ea-611de57def0d	{"decision_maker": true, "interest_level": "high"}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
b3147ed1-ec9c-48ef-8595-afef7a14f022	Task	7a6df292-01eb-40b3-852d-36599b59d86e	assigned_to	\N	User	0198b046-ce51-7755-bbce-7e68a6d3f953	{"role": "developer", "effort_percentage": 60}	2025-09-07 11:27:42.422513	\N	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-09-07 11:27:42.422513	\N	\N
81e4bf89-09d8-4270-ac68-30d64292c101	Task	7a6df292-01eb-40b3-852d-36599b59d86e	assigned_to	\N	User	0198b046-dadb-788a-8a65-e3f11ad45a75	{"role": "reviewer", "effort_percentage": 40}	2025-09-07 11:27:42.422513	\N	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-09-07 11:27:42.422513	\N	\N
96767e6b-64e5-4cd5-9e43-d4fcd6706a33	Invoice	e8e01470-713c-44f8-aa3f-893fdb3c7780	requires_approval_from	\N	User	0198b046-d931-7772-a1e8-b63c68c7f43d	{"threshold": 5000, "approval_level": 1}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
d2f2a875-9504-472b-aff1-fc48bea062a8	Invoice	e8e01470-713c-44f8-aa3f-893fdb3c7780	requires_approval_from	\N	User	0198b046-c453-72d9-b71a-092e1f75601a	{"threshold": 10000, "approval_level": 2}	2025-09-07 11:27:42.422513	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 11:27:42.422513	\N	\N
1c0d622a-0a42-4bc9-9fc1-f1b1e634407d	Invoice	40bd1de7-f9a3-43ef-91b8-fa2d251d0d05	references	\N	Project	dea1e46d-dcc8-4501-94ea-611de57def0d	{"amount": 25000, "reference_type": "billing_for"}	2025-09-07 11:27:42.422513	\N	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-09-07 11:27:42.422513	\N	\N
dd4e490a-8dfb-4307-bdab-7c688dda27b6	Task	5f6ea29a-0a15-4f8e-9b34-e12c515d8fed	references	\N	Invoice	40bd1de7-f9a3-43ef-91b8-fa2d251d0d05	{"notes": "Implementing features from invoice", "reference_type": "implementation_of"}	2025-09-07 11:27:42.422513	\N	0198b046-dadb-788a-8a65-e3f11ad45a75	2025-09-07 11:27:42.422513	\N	\N
eeb40901-673b-44b0-bcff-d90166f63983	Task	82840242-591a-4115-b230-417f3b9644de	assigned_to	\N	User	0198b046-c453-72d9-b71a-092e1f75601a	{"role": "owner", "effort_percentage": 100}	2025-09-07 12:00:41.629762	\N	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 12:00:41.629762	\N	\N
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_replicatestentity17571; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_replicatestentity17571 (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, custom_fields, test_field, test_number) FROM stdin;
fba33381-499a-4be0-ae84-be39e741b170	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-06 16:22:04.299	2025-09-06 16:25:25.019	Test Record for Replica Identity	Successfully updated with replica identity fix!	test	active	\N	\N	\N	{}	\N	0
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_reptest76123; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_reptest76123 (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, custom_fields, test_field, test_number) FROM stdin;
88bc9c0e-aca0-46f0-a629-40d0fd0b4ba2	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-06 16:28:43.901	2025-09-06 16:28:43.99	Test Record	Successfully updated!	test	active	\N	\N	\N	{}	\N	0
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_schema_test_entity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_schema_test_entity (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, test_field) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_security_badge; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_security_badge (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_softdeletetests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_softdeletetests (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, reporter_id, due_date, estimated_hours, actual_hours, task_type, parent_task_id, project_id, sprint_id, story_points) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_task (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, reporter_id, due_date, estimated_hours, actual_hours, task_type, parent_task_id, project_id, sprint_id, story_points) FROM stdin;
50c67b55-6e6c-4f0d-b6e6-7e25d0ca9786	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:34.509	2025-09-08 12:25:34.509	Test Vertical Scroll 6	Testing vertical scrolling with many tasks - Task 6	high	todo	\N	\N	\N	7	\N	feature	\N	\N	\N	\N
a13c8b30-f6cc-4009-89f7-4a56351b5047	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:34.97	2025-09-08 12:25:34.97	Test Vertical Scroll 7	Testing vertical scrolling with many tasks - Task 7	medium	todo	\N	\N	\N	8	\N	bug	\N	\N	\N	\N
55e0fefd-febe-49ff-a34e-da4d1392184b	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:35.148	2025-09-08 12:25:35.148	Test Vertical Scroll 8	Testing vertical scrolling with many tasks - Task 8	low	completed	\N	\N	\N	9	\N	enhancement	\N	\N	\N	\N
541d78cb-72c9-4acc-892b-c480600019f5	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:35.329	2025-09-08 12:25:35.329	Test Vertical Scroll 9	Testing vertical scrolling with many tasks - Task 9	high	in_progress	\N	\N	\N	10	\N	feature	\N	\N	\N	\N
50f82ac0-8fe8-4d42-8d23-b29bad53047f	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:35.511	2025-09-08 12:25:35.511	Test Vertical Scroll 10	Testing vertical scrolling with many tasks - Task 10	medium	todo	\N	\N	\N	11	\N	bug	\N	\N	\N	\N
c3cb3e4c-82fe-4105-a2ff-e655bcd68f46	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:35.708	2025-09-08 12:25:35.708	Test Vertical Scroll 11	Testing vertical scrolling with many tasks - Task 11	low	todo	\N	\N	\N	12	\N	enhancement	\N	\N	\N	\N
62e20872-53e7-4fb5-aad7-2e69bbf7bb19	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:29.535293	2025-09-09 01:09:31.974	API integration	Integrate with backend APIs	medium	todo	12480000-0000-4000-8000-000000000001	\N	\N	\N	\N	feature	\N	f95d1f22-1a38-4cf9-b76c-ba8414a8d278	\N	\N
7ce84b7e-4d57-45db-9dd5-9ab7690c166f	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:29.535293	2025-09-08 20:51:33.05	Testing and QA	Complete testing suite	medium	todo	12480000-0000-4000-8000-000000000001	\N	\N	\N	\N	testing	\N	f95d1f22-1a38-4cf9-b76c-ba8414a8d278	\N	\N
04d494ce-13f1-44ae-8048-c46fbc946e90	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:33.958	2025-09-09 01:10:28.065	Test Vertical Scroll 3	Testing vertical scrolling with many tasks - Task 3	high	todo	\N	\N	\N	4	\N	feature	\N	\N	\N	\N
21851e6e-2c44-45d6-802f-b813a70ff89e	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:29.535293	2025-09-09 00:24:29.598	CURL Direct Test Update	Testing direct API call	high	in_progress	12480000-0000-4000-8000-000000000001	\N	\N	\N	\N	setup	\N	f95d1f22-1a38-4cf9-b76c-ba8414a8d278	\N	\N
41521a77-42eb-4f8c-9bfc-a72f5f0fbe8d	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:29.535293	2025-09-09 00:36:08.195	Database schema design	Design and implement database schema	high	completed	12480000-0000-4000-8000-000000000001	\N	\N	\N	\N	design	\N	f95d1f22-1a38-4cf9-b76c-ba8414a8d278	\N	\N
90c9f585-ff23-4d3c-8e6c-08f359b6f776	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:23.618	2025-09-09 00:44:51.887	Test Vertical Scroll 1	Testing vertical scrolling with many tasks - Task 1	high	todo	\N	\N	\N	8	\N	feature	\N	\N	\N	\N
58d2bd53-0647-4898-b369-aab7a5bc03f1	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:34.133	2025-09-09 01:20:33.329	EDITED: Testing Value Flow Fix	Testing vertical scrolling with many tasks - Task 4	medium	completed	\N	\N	\N	5	\N	bug	\N	\N	\N	\N
681b4c00-2ee5-4d39-9cf5-2a78312a3c76	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:33.769	2025-09-09 00:53:05.811	Test Vertical Scroll 2	Testing vertical scrolling with many tasks - Task 2	low	todo	\N	\N	\N	3	\N	enhancement	\N	\N	\N	\N
160e57e6-4eef-4e32-9afe-e4d052e9bde4	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:29.535293	2025-09-09 00:55:34.071	Authentication system	Implement user authentication	high	in_progress	12480000-0000-4000-8000-000000000001	\N	\N	\N	\N	feature	\N	f95d1f22-1a38-4cf9-b76c-ba8414a8d278	\N	\N
e1a00686-898b-4b89-ac6a-283a09d373f4	01920000-1000-7000-8000-000000000001	12480000-0000-4000-8000-000000000001	2025-09-07 16:51:29.535293	2025-09-09 00:56:24.151	Design mockups	Create UI/UX mockups	high	in_progress	12480000-0000-4000-8000-000000000001	\N	\N	\N	\N	design	\N	f95d1f22-1a38-4cf9-b76c-ba8414a8d278	\N	\N
7186f37d-ea93-4f5e-af5c-61c5f8fac2e2	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:34.328	2025-09-09 01:21:21.431	Test Vertical Scroll 5 134	Testing vertical scrolling with many tasks - Task 5	low	in_progress	\N	\N	\N	6	\N	enhancement	\N	\N	\N	\N
aaccd2af-15ee-4bca-9158-6d4dd9f44db3	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:35.899	2025-09-08 12:25:35.899	Test Vertical Scroll 12	Testing vertical scrolling with many tasks - Task 12	high	completed	\N	\N	\N	13	\N	feature	\N	\N	\N	\N
7880be54-9ac1-4add-b349-9a205da057f0	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:36.092	2025-09-08 12:25:36.093	Test Vertical Scroll 13	Testing vertical scrolling with many tasks - Task 13	medium	in_progress	\N	\N	\N	14	\N	bug	\N	\N	\N	\N
7e2be59a-c5eb-4003-8e97-047794b48206	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:36.276	2025-09-08 12:25:36.276	Test Vertical Scroll 14	Testing vertical scrolling with many tasks - Task 14	low	todo	\N	\N	\N	15	\N	enhancement	\N	\N	\N	\N
78852b31-bc25-474e-bc2c-25c5dbc8173d	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:36.473	2025-09-08 12:25:36.473	Test Vertical Scroll 15	Testing vertical scrolling with many tasks - Task 15	high	todo	\N	\N	\N	16	\N	feature	\N	\N	\N	\N
fe2e3b81-480e-4f5e-9238-7273ddd0ba02	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:36.673	2025-09-08 12:25:36.673	Test Vertical Scroll 16	Testing vertical scrolling with many tasks - Task 16	medium	completed	\N	\N	\N	1	\N	bug	\N	\N	\N	\N
1d6d0bd8-438b-40b7-b8e7-209a19763dcf	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:36.862	2025-09-08 12:25:36.862	Test Vertical Scroll 17	Testing vertical scrolling with many tasks - Task 17	low	in_progress	\N	\N	\N	2	\N	enhancement	\N	\N	\N	\N
8ec062ae-c38b-4e33-9ce8-9f0f2ed08883	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:37.043	2025-09-08 12:25:37.043	Test Vertical Scroll 18	Testing vertical scrolling with many tasks - Task 18	high	todo	\N	\N	\N	3	\N	feature	\N	\N	\N	\N
dfdcf7ae-bdac-4f28-bd1a-8ce0c5f93d36	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:37.238	2025-09-08 12:25:37.238	Test Vertical Scroll 19	Testing vertical scrolling with many tasks - Task 19	medium	todo	\N	\N	\N	4	\N	bug	\N	\N	\N	\N
49921ca2-2388-4f12-a5ba-dfa2bcc847b6	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:37.428	2025-09-08 12:25:37.428	Test Vertical Scroll 20	Testing vertical scrolling with many tasks - Task 20	low	completed	\N	\N	\N	5	\N	enhancement	\N	\N	\N	\N
01eed88b-9313-478e-ae71-2e80ecbb24cd	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:37.615	2025-09-08 12:25:37.615	Test Vertical Scroll 21	Testing vertical scrolling with many tasks - Task 21	high	in_progress	\N	\N	\N	6	\N	feature	\N	\N	\N	\N
36c07c59-3550-43ef-9d50-afdcdf038c62	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:37.804	2025-09-08 12:25:37.804	Test Vertical Scroll 22	Testing vertical scrolling with many tasks - Task 22	medium	todo	\N	\N	\N	7	\N	bug	\N	\N	\N	\N
2c002469-5377-4989-87a5-9e0d967b0bf1	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:37.988	2025-09-08 12:25:37.988	Test Vertical Scroll 23	Testing vertical scrolling with many tasks - Task 23	low	todo	\N	\N	\N	8	\N	enhancement	\N	\N	\N	\N
cf77a499-7c27-4b4a-8f92-77b504b3e77c	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:38.167	2025-09-08 12:25:38.167	Test Vertical Scroll 24	Testing vertical scrolling with many tasks - Task 24	high	completed	\N	\N	\N	9	\N	feature	\N	\N	\N	\N
eff77a14-7adb-483a-83ec-3725cfeed0a8	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:38.351	2025-09-08 12:25:38.351	Test Vertical Scroll 25	Testing vertical scrolling with many tasks - Task 25	medium	in_progress	\N	\N	\N	10	\N	bug	\N	\N	\N	\N
b4ee8472-f01c-413e-bc1e-1c86c7889f59	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:38.535	2025-09-08 12:25:38.535	Test Vertical Scroll 26	Testing vertical scrolling with many tasks - Task 26	low	todo	\N	\N	\N	11	\N	enhancement	\N	\N	\N	\N
85545507-418c-42e1-8086-abbdbd82c9fa	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:38.737	2025-09-08 12:25:38.737	Test Vertical Scroll 27	Testing vertical scrolling with many tasks - Task 27	high	todo	\N	\N	\N	12	\N	feature	\N	\N	\N	\N
e58fe3eb-13c0-48c9-abd6-62a37f4e14ab	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:38.934	2025-09-08 12:25:38.934	Test Vertical Scroll 28	Testing vertical scrolling with many tasks - Task 28	medium	completed	\N	\N	\N	13	\N	bug	\N	\N	\N	\N
25e1a6e9-36ca-452d-92b3-6b2d01d4075f	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:39.139	2025-09-08 12:25:39.139	Test Vertical Scroll 29	Testing vertical scrolling with many tasks - Task 29	low	in_progress	\N	\N	\N	14	\N	enhancement	\N	\N	\N	\N
dc0e450d-7a03-449b-8573-04a5c83c5c8f	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-08 12:25:39.32	2025-09-08 12:25:39.32	Test Vertical Scroll 30	Testing vertical scrolling with many tasks - Task 30	high	todo	\N	\N	\N	15	\N	feature	\N	\N	\N	\N
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_teamtask; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_teamtask (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, due_date, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_temptests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_temptests (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testactivity1757185633; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testactivity1757185633 (id, organization_id, created_by, created_at, updated_at, activity_type, description, entity_type, entity_id, actor_id, metadata, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testactivity1757185635; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testactivity1757185635 (id, organization_id, created_by, created_at, updated_at, activity_type, description, entity_type, entity_id, actor_id, metadata, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testactivity1757185724; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testactivity1757185724 (id, organization_id, created_by, created_at, updated_at, activity_type, description, entity_type, entity_id, actor_id, metadata, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testcollection17571856; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testcollection17571856 (id, organization_id, created_by, created_at, updated_at, name, description, collection_type, items, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testcollection17571857; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testcollection17571857 (id, organization_id, created_by, created_at, updated_at, name, description, collection_type, items, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testcompany2s; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testcompany2s (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, industry, revenue) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testcompanys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testcompanys (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, industry, revenue) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdebugentity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdebugentity (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdeletes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdeletes (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, reporter_id, due_date, estimated_hours, actual_hours, task_type, parent_task_id, project_id, sprint_id, story_points) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdiscussion17571856; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdiscussion17571856 (id, organization_id, created_by, created_at, updated_at, title, content, status, discussion_type, author_id, parent_discussion_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdiscussion17571857; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdiscussion17571857 (id, organization_id, created_by, created_at, updated_at, title, content, status, discussion_type, author_id, parent_discussion_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdocument1757185633; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdocument1757185633 (id, organization_id, created_by, created_at, updated_at, title, content, status, category, author_id, parent_document_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdocument1757185635; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdocument1757185635 (id, organization_id, created_by, created_at, updated_at, title, content, status, category, author_id, parent_document_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testdocument1757185724; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testdocument1757185724 (id, organization_id, created_by, created_at, updated_at, title, content, status, category, author_id, parent_document_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testduplicate175718563; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testduplicate175718563 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testduplicate175718572; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testduplicate175718572 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testduplicate175718598; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testduplicate175718598 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testduplicate175718600; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testduplicate175718600 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testentitys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testentitys (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, reporter_id, due_date, estimated_hours, actual_hours, task_type, parent_task_id, project_id, sprint_id, story_points) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testfile1757185633585; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testfile1757185633585 (id, organization_id, created_by, created_at, updated_at, name, file_path, mime_type, size_bytes, status, uploaded_by, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testfile1757185635467; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testfile1757185635467 (id, organization_id, created_by, created_at, updated_at, name, file_path, mime_type, size_bytes, status, uploaded_by, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testfile1757185724220; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testfile1757185724220 (id, organization_id, created_by, created_at, updated_at, name, file_path, mime_type, size_bytes, status, uploaded_by, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testmanualentity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testmanualentity (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testproduct; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testproduct (id, organization_id, created_by, created_at, updated_at, name, description, status, data, custom_fields, category, is_featured) FROM stdin;
81a265b6-0bbf-4327-8f9e-3a76bb538325	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-07 15:07:51.487	2025-09-07 15:08:24.128	Test Product Alpha - Updated	A test product with custom fields	draft	\N	{"sku": "TEST-001", "price": 39.99}	premium_electronics	f
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testproductfixed; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testproductfixed (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
71f0f61d-f47e-4108-9599-b55686994479	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-09-06 15:53:41.834	2025-09-06 15:54:08.023	Test Product	Updated product description	product	premium	\N	\N	\N	{"unit_price": 75, "product_code": "PRD-001"}
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testproducts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testproducts (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, sku, price) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testproject17571856328; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testproject17571856328 (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testproject17571857233; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testproject17571857233 (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testprojectdebug; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testprojectdebug (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testprojects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testprojects (id, organization_id, created_by, created_at, updated_at, name, description, priority, status, start_date, end_date, owner_id, budget, progress_percentage, project_type) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testrecord175718563323; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testrecord175718563323 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testrecord175718563423; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testrecord175718563423 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testrecord175718563499; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testrecord175718563499 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testrecord175718572369; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testrecord175718572369 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testrecord175718572488; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testrecord175718572488 (id, organization_id, created_by, created_at, updated_at, name, description, status, data, parent_record_id, owner_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testtask1757185633070; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testtask1757185633070 (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, due_date, parent_task_id, project_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testtask1757185634598; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testtask1757185634598 (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, due_date, parent_task_id, project_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testtask1757185723520; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testtask1757185723520 (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, due_date, parent_task_id, project_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_testtask1757185725218; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_testtask1757185725218 (id, organization_id, created_by, created_at, updated_at, title, description, priority, status, assignee_id, due_date, parent_task_id, project_id, custom_fields) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_time_sheet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_time_sheet (id, organization_id, created_by, created_at, updated_at, activity_type, description, entity_type, entity_id, actor_id, metadata) FROM stdin;
18e7e162-ee9b-401b-8cea-62e2e3b162a2	01920000-1000-7000-8000-000000000001	\N	2025-08-23 19:16:27.643	2025-08-23 19:16:27.643	work_session	Testing activity archetype with org-wide read-only permissions	project	dea1e46d-dcc8-4501-94ea-611de57def0d	\N	\N
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_universes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_universes (id, organization_id, created_by, created_at, updated_at, name, description, owner_id) FROM stdin;
85d2018c-c97f-4b81-b8dc-aefef3d86e0c	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 16:16:07.099	2025-08-31 16:16:07.099	Alice Universe	Alice CEO Personal Life Operating System	0198b046-c453-72d9-b71a-092e1f75601a
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_user_permission_group; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_user_permission_group (id, organization_id, created_by, created_at, updated_at, name, description, record_type, status, data, parent_record_id, owner_id) FROM stdin;
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_worlds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_worlds (id, organization_id, created_by, created_at, updated_at, name, description, universe_id, state, world_type, priority) FROM stdin;
c59b7733-c958-446a-9115-5b5d09bdec2e	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 18:57:55.902638	2025-08-31 18:57:55.902638	Alice Personal World	Personal productivity world	85d2018c-c97f-4b81-b8dc-aefef3d86e0c	active	personal	high
world-strategic-planning	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:20.538994	2025-08-31 23:12:20.538994	Strategic Planning	Long-term strategic initiatives and company direction	\N	active	business	critical
world-operations-mgmt	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:20.538994	2025-08-31 23:12:20.538994	Operations Management	Daily operations and process optimization	\N	active	business	high
world-client-relations	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:20.538994	2025-08-31 23:12:20.538994	Client Relations	Client management and business development	\N	active	client	high
world-product-dev	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:20.538994	2025-08-31 23:12:20.538994	Product Development	Innovation and product roadmap management	\N	developing	project_domain	high
world-financial-mgmt	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:20.538994	2025-08-31 23:12:20.538994	Financial Management	Budget planning and financial oversight	\N	active	department	critical
world-team-leadership	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:20.538994	2025-08-31 23:12:20.538994	Team Leadership	HR management and team development	\N	active	department	high
world-personal-growth	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:30.742804	2025-08-31 23:12:30.742804	Personal Development	Learning, skills development, and personal goals	85d2018c-c97f-4b81-b8dc-aefef3d86e0c	active	personal	high
world-health-fitness	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:30.742804	2025-08-31 23:12:30.742804	Health & Fitness	Physical health, fitness routines, and wellness	85d2018c-c97f-4b81-b8dc-aefef3d86e0c	active	personal	high
world-family-life	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 23:12:30.742804	2025-08-31 23:12:30.742804	Family & Relationships	Family time, relationships, and personal commitments	85d2018c-c97f-4b81-b8dc-aefef3d86e0c	active	personal	medium
\.


--
-- Data for Name: org_01920000_1000_7000_8000_000000000001_worldss; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_1000_7000_8000_000000000001_worldss (id, organization_id, created_by, created_at, updated_at, name, description, universe_id, state, world_type, priority) FROM stdin;
c59b7733-c958-446a-9115-5b5d09bdec2e	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-31 18:57:55.902638	2025-08-31 18:57:55.902638	Alice Personal World	Personal productivity world	85d2018c-c97f-4b81-b8dc-aefef3d86e0c	active	personal	high
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_activity (id, organization_id, subject_type, subject_id, activity_type, description, metadata, performed_by, created_at, deleted, deleted_at) FROM stdin;
d79281c7-2de1-4ff2-8523-441f74b33c6f	01920000-2000-7000-8000-000000000002	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	email_sent	Sent welcome email	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.920925+00	f	\N
d279a9de-86da-456b-9d2a-a6d15255d625	01920000-2000-7000-8000-000000000002	deal	57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	stage_changed	Moved to proposal stage	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.922649+00	f	\N
20f85c7b-34b6-47dc-8006-05e402864c05	01920000-2000-7000-8000-000000000002	ticket	c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	priority_changed	Priority changed to high	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.924264+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_attachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_attachment (id, organization_id, attachable_type, attachable_id, filename, file_url, file_size, mime_type, uploaded_by, created_at, updated_at, deleted, deleted_at) FROM stdin;
6a2f3ffb-c89f-4207-a64d-d16220f01c2c	01920000-2000-7000-8000-000000000002	deal	57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	proposal.pdf	\N	1024000	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.915578+00	2025-08-16 00:48:25.915578+00	f	\N
7c550067-43f2-4486-9de1-aceca8ee5fb5	01920000-2000-7000-8000-000000000002	ticket	c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	screenshot.png	\N	512000	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.917466+00	2025-08-16 00:48:25.917466+00	f	\N
51033829-547a-4756-804c-c8250b5c38fc	01920000-2000-7000-8000-000000000002	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	business_card.jpg	\N	256000	\N	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.919205+00	2025-08-16 00:48:25.919205+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_comment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_comment (id, organization_id, commentable_type, commentable_id, content, author_id, is_internal, created_by, created_at, updated_at, deleted, deleted_at) FROM stdin;
c692653d-b411-460d-a808-e64f95a6d117	01920000-2000-7000-8000-000000000002	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	Great lead, very interested in our enterprise solution	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.906096+00	2025-08-16 00:48:25.906096+00	f	\N
b7f09c3a-e5dc-428e-91da-6e051a227aa2	01920000-2000-7000-8000-000000000002	contact	e3365112-b17f-423c-9493-6ea775e600e0	Startup looking for cost-effective options	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.90818+00	2025-08-16 00:48:25.90818+00	f	\N
21a877f8-f203-4ead-8b5a-adc4ba1bb0e9	01920000-2000-7000-8000-000000000002	deal	57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	Need to schedule demo next week	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.909684+00	2025-08-16 00:48:25.909684+00	f	\N
c58d22e1-07a8-441f-a741-954f19c182d8	01920000-2000-7000-8000-000000000002	deal	d5abde47-af13-41dd-b6ad-bdc05f2b9de7	Client wants to discuss timeline	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.911043+00	2025-08-16 00:48:25.911043+00	f	\N
9bc8c477-0755-46f8-aaf0-174482e02cc0	01920000-2000-7000-8000-000000000002	ticket	c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	Escalated to development team	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.912667+00	2025-08-16 00:48:25.912667+00	f	\N
b54f99d0-48cc-463e-83a3-89f0bc02a70e	01920000-2000-7000-8000-000000000002	ticket	a9e18a8f-ece8-41ed-bbf7-9f644d8debd9	Added to product roadmap for Q2	0198b059-5419-7165-b2c3-937a66b94865	f	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.914051+00	2025-08-16 00:48:25.914051+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_contact (id, organization_id, first_name, last_name, email, phone, company, status, created_by, assigned_to, created_at, updated_at, deleted, deleted_at) FROM stdin;
bad4d81c-77b4-411d-98e0-6a1f8c32b185	01920000-2000-7000-8000-000000000002	John	Smith	john@techcorp.com	\N	Tech Corp	active	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.894232+00	2025-08-16 00:48:25.894232+00	f	\N
e3365112-b17f-423c-9493-6ea775e600e0	01920000-2000-7000-8000-000000000002	Jane	Doe	jane@startup.io	\N	Startup Inc	active	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.896717+00	2025-08-16 00:48:25.896717+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_custom_field_definitio; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_custom_field_definitio (id, organization_id, entity_type, field_name, field_type, field_options, is_required, display_order, created_by, created_at, updated_at, deleted, deleted_at) FROM stdin;
03bf2a35-6412-4883-ab37-accd644db9ac	01920000-2000-7000-8000-000000000002	contact	Industry	select	["Technology", "Healthcare", "Finance"]	f	0	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.926+00	2025-08-16 00:48:25.926+00	f	\N
856fe3c2-2600-42bc-beff-a168e95610f2	01920000-2000-7000-8000-000000000002	deal	Source	text	null	f	0	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.928373+00	2025-08-16 00:48:25.928373+00	f	\N
baa48f7d-b36d-4083-ac18-ac9c085cbfd4	01920000-2000-7000-8000-000000000002	ticket	Resolution Time	number	null	f	0	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.930087+00	2025-08-16 00:48:25.930087+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_custom_field_value; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_custom_field_value (id, organization_id, field_definition_id, entity_type, entity_id, value_text, value_number, value_date, value_boolean, value_json, created_at, updated_at, deleted, deleted_at) FROM stdin;
6b8960eb-56f0-4aee-b9a7-e6737e382a87	01920000-2000-7000-8000-000000000002	03bf2a35-6412-4883-ab37-accd644db9ac	contact	bad4d81c-77b4-411d-98e0-6a1f8c32b185	Technology	\N	\N	\N	\N	2025-08-16 00:48:25.931848+00	2025-08-16 00:48:25.931848+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_deal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_deal (id, organization_id, title, value, stage, probability, close_date, contact_id, created_by, assigned_to, created_at, updated_at, deleted, deleted_at) FROM stdin;
57c41aa2-de0b-4ed0-b5c9-d6556dcf3daa	01920000-2000-7000-8000-000000000002	Enterprise Software Deal	50000.00	proposal	50	\N	bad4d81c-77b4-411d-98e0-6a1f8c32b185	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.898597+00	2025-08-16 00:48:25.898597+00	f	\N
d5abde47-af13-41dd-b6ad-bdc05f2b9de7	01920000-2000-7000-8000-000000000002	Consulting Services	25000.00	negotiation	50	\N	e3365112-b17f-423c-9493-6ea775e600e0	0198b059-5419-7165-b2c3-937a66b94865	0198b059-5999-7f84-8217-0506a838e0da	2025-08-16 00:48:25.900477+00	2025-08-16 00:48:25.900477+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_sync_configuration; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_sync_configuration (id, organization_id, entity_type, sync_options, is_enabled, created_by, created_at, updated_at, deleted, deleted_at) FROM stdin;
3322602c-f48f-430a-a865-159207655165	01920000-2000-7000-8000-000000000002	contact	{"sync_mode": "full", "custom_filters": {"status": ["active"]}, "system_options": {"batch_size": 100, "enable_real_time": true}, "include_polymorphic": true, "polymorphic_relations": ["comment", "attachment", "activity"]}	t	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.93477+00	2025-08-16 00:48:25.93477+00	f	\N
67187a74-4a55-467d-86b5-e03ff5d85149	01920000-2000-7000-8000-000000000002	deal	{"sync_mode": "incremental", "custom_filters": {"stage": ["proposal", "negotiation", "closed_won"]}, "system_options": {"batch_size": 50, "enable_real_time": false}, "include_polymorphic": true, "polymorphic_relations": ["comment", "attachment"]}	t	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.937386+00	2025-08-16 00:48:25.937386+00	f	\N
62795f0f-ab57-47c4-a739-1df03cb66076	01920000-2000-7000-8000-000000000002	comment	{"sync_mode": "full", "custom_filters": {"is_internal": [false]}, "system_options": {"enable_real_time": true}, "polymorphic_parent_required": true}	t	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.939026+00	2025-08-16 00:48:25.939026+00	f	\N
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_tag (id, organization_id, name, color, created_by, created_at, updated_at, deleted, deleted_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_tagging; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_tagging (id, organization_id, tag_id, taggable_type, taggable_id, created_by, created_at, deleted, deleted_at) FROM stdin;
\.


--
-- Data for Name: org_01920000_2000_7000_8000_000000000002_ticket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_01920000_2000_7000_8000_000000000002_ticket (id, organization_id, subject, description, priority, status, contact_id, assigned_to, created_by, created_at, updated_at, deleted, deleted_at) FROM stdin;
c0dfd6b6-8c06-4aa6-9925-42008d8f50b4	01920000-2000-7000-8000-000000000002	Login Issues	Customer cannot access portal	high	open	bad4d81c-77b4-411d-98e0-6a1f8c32b185	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.90213+00	2025-08-16 00:48:25.90213+00	f	\N
a9e18a8f-ece8-41ed-bbf7-9f644d8debd9	01920000-2000-7000-8000-000000000002	Feature Request	Need custom reporting	medium	open	e3365112-b17f-423c-9493-6ea775e600e0	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	0198b059-5419-7165-b2c3-937a66b94865	2025-08-16 00:48:25.904114+00	2025-08-16 00:48:25.904114+00	f	\N
\.


--
-- Data for Name: org_relationship_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_relationship_definitions (id, org_id, relationship_type, display_name, description, allowed_source_types, allowed_target_types, cardinality, is_directional, inverse_relationship_type, property_schema, ui_config, is_system, is_active) FROM stdin;
f162688e-a29e-4fb3-a48b-7a8fbb6b9c77	01920000-1000-7000-8000-000000000001	assigned_to	Assigned To	User assigned to work on this item	{Task,Project,Document}	{User}	many-to-many	t	\N	\N	\N	f	t
0a6b9a9f-768b-46a3-9aab-b63a299c172e	01920000-1000-7000-8000-000000000001	blocks	Blocks	This task blocks another task	{Task}	{Task}	one-to-many	t	blocked_by	\N	\N	f	t
7233eaa9-e740-48e7-b873-83c477efc2ba	01920000-1000-7000-8000-000000000001	blocked_by	Blocked By	This task is blocked by another task	{Task}	{Task}	many-to-one	t	blocks	\N	\N	f	t
c04ff6d8-de38-4e2c-9493-c57f0706e12a	01920000-1000-7000-8000-000000000001	subtask_of	Subtask Of	This task is a subtask of another	{Task}	{Task}	many-to-one	t	has_subtask	\N	\N	f	t
acb14f62-9936-420a-a0b0-2136efc8ffc1	01920000-1000-7000-8000-000000000001	has_subtask	Has Subtask	This task has subtasks	{Task}	{Task}	one-to-many	t	subtask_of	\N	\N	f	t
52ec74fc-7b16-48cf-a8af-0f2c6e96bbc4	01920000-1000-7000-8000-000000000001	member_of	Member Of	User is member of project/team	{User}	{Project}	many-to-many	f	\N	\N	\N	f	t
b80cb25e-b5c5-4834-bd47-405fd569d0ef	01920000-1000-7000-8000-000000000001	manages	Manages	User manages this entity	{User}	{Project,Task}	one-to-many	t	managed_by	\N	\N	f	t
1193a07e-eb7a-4ef0-b90a-f75181a14c17	01920000-1000-7000-8000-000000000001	managed_by	Managed By	Entity is managed by user	{Project,Task}	{User}	many-to-one	t	manages	\N	\N	f	t
2c3dd02f-fa05-4e98-a7ff-6d144d31b8c2	01920000-1000-7000-8000-000000000001	authored_by	Authored By	Document authored by user	{Document,Invoice,Contract}	{User}	many-to-many	t	author_of	\N	\N	f	t
9cbfe4a6-f46e-467b-8669-84f5ed084f68	01920000-1000-7000-8000-000000000001	author_of	Author Of	User authored this document	{User}	{Document,Invoice,Contract}	many-to-many	t	authored_by	\N	\N	f	t
816d73b9-3656-4b77-917a-a2e78ec5d721	01920000-1000-7000-8000-000000000001	references	References	Entity references another entity	{*}	{*}	many-to-many	t	referenced_by	\N	\N	f	t
c934020a-545a-498b-9ab4-b0b089462bbf	01920000-1000-7000-8000-000000000001	referenced_by	Referenced By	Entity is referenced by another	{*}	{*}	many-to-many	t	references	\N	\N	f	t
c9dad8b9-ab28-42c7-8319-6ca2ee1a9445	01920000-1000-7000-8000-000000000001	requires_approval_from	Requires Approval	Requires approval from user	{Invoice,Expense,Contract}	{User}	many-to-many	t	can_approve	\N	\N	f	t
709fb23f-403c-41d2-a31c-74042e67b087	01920000-1000-7000-8000-000000000001	approved_by	Approved By	Approved by user	{Invoice,Expense,Contract}	{User}	many-to-one	t	\N	\N	\N	f	t
dff24d69-f907-4de2-bfbd-6f4381369488	01920000-1000-7000-8000-000000000001	collaborates_with	Collaborates With	Users collaborate together	{User}	{User}	many-to-many	f	\N	\N	\N	f	t
fb02292b-27c5-4466-af00-a4bbeb814ad1	01920000-1000-7000-8000-000000000001	watching	Watching	User is watching for updates	{User}	{Task,Project,Document}	many-to-many	t	watched_by	\N	\N	f	t
16c18925-3434-4752-838c-c4c4b30a7fd1	01920000-1000-7000-8000-000000000001	watched_by	Watched By	Entity is watched by users	{Task,Project,Document}	{User}	many-to-many	t	watching	\N	\N	f	t
412dcddb-3d16-47e5-b5e5-8d0aad3b7783	01920000-1000-7000-8000-000000000001	reports_to	Reports To	Organizational reporting structure	{User}	{User}	many-to-one	t	supervises	\N	\N	f	t
f2c6c2a0-bed2-485c-b9b4-e098ef91e90c	01920000-1000-7000-8000-000000000001	supervises	Supervises	User supervises other users	{User}	{User}	one-to-many	t	reports_to	\N	\N	f	t
424aa3d3-dc1c-43b4-bd46-0743b3034fbe	01920000-1000-7000-8000-000000000001	stakeholder_in	Stakeholder In	User is stakeholder in entity	{User}	{Project,Task}	many-to-many	t	has_stakeholder	\N	\N	f	t
70f6a1f5-f863-4b92-bc8d-11baacc24647	01920000-1000-7000-8000-000000000001	escalated_to	Escalated To	Issue escalated to user	{Task,Issue}	{User}	many-to-one	t	\N	\N	\N	f	t
9d3a8d04-a3bb-43b2-a6aa-202c2d646d4c	01920000-1000-7000-8000-000000000001	mentors	Mentors	User mentors another user	{User}	{User}	one-to-many	t	mentored_by	\N	\N	f	t
4576832c-3de8-4177-98ad-bbae159ccb85	01920000-1000-7000-8000-000000000001	mentored_by	Mentored By	User is mentored by another	{User}	{User}	many-to-one	t	mentors	\N	\N	f	t
\.


--
-- Data for Name: organization_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_members (id, organization_id, user_id, role, created_at, updated_at) FROM stdin;
1720525c-182e-4432-b64d-02e1c89a432e	108b0ac2-487f-4951-b295-b1924288daad	0198aed6-cc0b-783b-b414-c5fb8a81f227	owner	2025-08-15 21:35:14.978262+00	2025-08-15 21:35:14.978262+00
d0a384fe-60e3-4836-addb-9e78cd396b28	01920000-2000-7000-8000-000000000002	0198b046-c453-72d9-b71a-092e1f75601a	owner	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
ade1bc51-6e6c-43d7-8631-3cb653fe44ca	01920000-2000-7000-8000-000000000002	0198b046-d127-769d-9bc2-8e5824b71b3a	admin	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
ae14c90c-af72-4bcc-849b-d595f655d2a1	01920000-2000-7000-8000-000000000002	0198b046-e873-7739-bac2-10db9440486b	member	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
29fe5e23-954f-417b-b2cd-a65714935eee	01920000-2000-7000-8000-000000000002	0198b046-fe7a-7855-b4d8-4408253dc9c5	viewer	2025-08-16 00:49:05.699316+00	2025-08-16 00:50:31.197918+00
0f1f732d-2aac-44e0-8dda-b942f5e7df56	0a1eaf20-5386-43e8-ad36-73fafefeb500	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	owner	2025-08-16 13:09:39.973285+00	2025-08-16 13:09:39.973285+00
751bdff3-5c50-4950-bfdb-98a67248b8e7	01920000-1000-7000-8000-000000000001	0198d86e-2544-71f8-8188-026e43f726c6	member	2025-08-23 19:36:22.392027+00	2025-08-23 19:36:22.392027+00
31d6014d-9fb1-4afc-901b-bc3be55ce39b	01920000-1000-7000-8000-000000000001	0198d86e-3ed0-7bf2-9317-674ef372c7db	member	2025-08-23 19:36:22.392027+00	2025-08-29 15:20:21.916+00
57875fa2-47e5-4dfd-98b8-fedc4048a0d0	01920000-1000-7000-8000-000000000001	0198b046-fe7a-7855-b4d8-4408253dc9c5	member	2025-08-16 00:28:20.582832+00	2025-08-29 15:21:53.537+00
3f754850-33da-4429-9a9d-e61af9a7647b	01920000-1000-7000-8000-000000000001	0198b046-d931-7772-a1e8-b63c68c7f43d	admin	2025-08-16 00:28:11.361111+00	2025-08-29 15:21:59.437+00
86b9c15e-a288-47ed-bc16-a8e2ce83df31	01920000-1000-7000-8000-000000000001	0198b046-e873-7739-bac2-10db9440486b	manager	2025-08-16 00:28:15.056967+00	2025-08-29 15:22:44.458+00
01e53386-d61c-481f-b859-0ea976742fb9	01920000-1000-7000-8000-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	owner	2025-08-16 00:28:07.222311+00	2025-08-16 00:28:07.222311+00
60fa17d6-cd84-4e4b-8e0d-54fedcbe852a	01920000-1000-7000-8000-000000000001	0198b046-d127-769d-9bc2-8e5824b71b3a	admin	2025-08-16 00:28:09.157583+00	2025-08-16 00:28:09.157583+00
4743269b-340f-4646-8dc3-2feb52b56f09	01920000-1000-7000-8000-000000000001	0198b046-e16b-7b46-a15e-baa49fd29990	manager	2025-08-16 00:28:13.09514+00	2025-08-16 00:28:13.09514+00
bb7bafa4-889d-411a-a570-ed116270fc65	01920000-1000-7000-8000-000000000001	0198b046-f056-7735-a3aa-60e8a329dd23	member	2025-08-16 00:28:16.977579+00	2025-08-16 00:28:16.977579+00
5a1542f2-91e8-4aa0-89c4-828f42e70b4f	01920000-1000-7000-8000-000000000001	0198b046-f71e-7bec-a853-294d7cbcbda5	contributor	2025-08-16 00:28:18.715016+00	2025-08-16 00:28:18.715016+00
c2316f1b-0d9d-4400-86fe-4f35d0cea98a	01920000-2000-7000-8000-000000000002	0198b059-5419-7165-b2c3-937a66b94865	owner	2025-08-16 00:48:21.716713+00	2025-08-16 00:48:21.716713+00
f8b9148a-b311-4062-b217-432589b2aff5	01920000-2000-7000-8000-000000000002	0198b059-5999-7f84-8217-0506a838e0da	admin	2025-08-16 00:48:23.214209+00	2025-08-16 00:48:23.214209+00
1ab6e5eb-d370-4051-855c-0fac8d71cecd	01920000-2000-7000-8000-000000000002	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	member	2025-08-16 00:48:24.619398+00	2025-08-16 00:48:24.619398+00
a4f15768-dd75-4d29-9e23-182e1c3ba64e	01920000-2000-7000-8000-000000000002	0198b059-64c9-7c4f-87be-5b1a3704f1c3	viewer	2025-08-16 00:48:25.887498+00	2025-08-16 00:48:25.887498+00
e7e12646-bafb-4fa3-ae8e-5fb197c03a1c	72622cf0-b4c6-4f15-890f-e0b9f695fcdb	0198d836-58b6-7590-b715-8974f2033b0a	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
7b546fcb-3429-49f1-a129-1f99a5070c9a	665049a7-dfed-4f01-8180-41202efaba3a	0198d872-3eda-781e-910f-e8d109fbb967	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
bba629d9-7db9-43f5-8f29-5de28968c25a	4dd6b20a-aa87-4e43-a52d-7c42856d725e	0198f65b-d657-7440-a635-5b59be41b835	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
f2e293cb-1cde-4938-bafb-ac547774ea57	0031029c-9915-4de2-9179-ffbb159057f1	0198aed6-cc0b-783b-b414-c5fb8a81f227	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
fe1fb8aa-f887-42e3-b6af-6ed8665021a4	bddd93de-7a65-444a-88e1-0ea0334d012a	0198d86e-2544-71f8-8188-026e43f726c6	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
507102ff-fc32-4cfd-9289-b491191e46c1	ef1f96f1-cfab-478b-96e1-159fcdc02bb7	0198b046-d931-7772-a1e8-b63c68c7f43d	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
67400e37-1acc-491e-861a-8d9481789830	ec09e01f-1b70-44bd-85c1-79ee7bfb3cbe	0198b046-e16b-7b46-a15e-baa49fd29990	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
ea494dc4-1b28-4824-98c9-16c1eafe34e4	a5e17f31-827c-466d-a5f6-44480a0d9a26	0198b046-e873-7739-bac2-10db9440486b	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
994cb17f-b7e5-4ff6-9198-0618d5137c64	caf9988b-d2ef-43de-82b7-580833bd1b84	0198b046-f056-7735-a3aa-60e8a329dd23	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
41a2d895-8099-4232-ab2f-e49133c3df56	07635be6-a99b-4569-bf72-ceda2e450323	0198b046-f71e-7bec-a853-294d7cbcbda5	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
b7072742-93b0-4cb8-9ecb-4121e805330f	92d66d2b-726b-45f4-949e-25c29a0f8642	0198b046-fe7a-7855-b4d8-4408253dc9c5	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
2679c95c-25a7-4e4e-a722-e7bc99403bc5	24254bc5-5fdd-45f4-9694-f61a23a8562a	0198b2d6-f008-71e6-9fc9-7b5454b6ce5d	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
7ffd3a48-5f3d-4dd1-8785-d69300d379e9	eeb713e6-e94a-435e-a66a-41443d8658bf	0198b059-5419-7165-b2c3-937a66b94865	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
9da19cef-e0ab-45e0-8bed-4eb554d2d87c	1715c778-0ecd-4a3f-af5c-838ab51bbf0b	0198b059-5999-7f84-8217-0506a838e0da	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
98753831-4083-4bdc-8991-782b0e2bf04d	fdb6bff8-e11e-4a98-a5f8-4a8531386701	0198b059-5fbf-7da1-aeda-3ad0c3c3eb0e	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
feadfeb3-7da7-46d4-a8c2-d6205ce6fb95	8b525929-c8f5-4056-b343-1f85f70e34d2	0198b059-64c9-7c4f-87be-5b1a3704f1c3	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
9e584ea0-4a53-436a-a2da-4ec9fbcb9f84	75209771-bdad-4eda-96ab-fb14803668db	0198d86e-3ed0-7bf2-9317-674ef372c7db	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
8958d8e9-ce1b-4b9b-ab0c-84387cf17f65	81a82bbb-5544-4a9b-8215-5174887e224a	0198b046-d127-769d-9bc2-8e5824b71b3a	owner	2025-09-01 11:54:50.100666+00	2025-09-01 11:54:50.100666+00
4cab1c13-8405-4342-ae9e-7c37b1adf118	0198b046-c453-72d9-b71a-092e1f75601a	0198b046-c453-72d9-b71a-092e1f75601a	owner	2025-09-06 18:29:00.5756+00	2025-09-06 18:29:00.5756+00
01992556-60cb-7b0b-a499-bf67a907b49d	01992556-60c6-7a48-a54f-5348ded91e7e	01992556-5e1c-7c5e-aaf9-9493f425d57a	owner	2025-09-07 18:00:41.931+00	2025-09-07 18:00:41.931+00
0199258e-2bd8-70e2-9c7d-5b04b2d6294c	0199258e-2bcf-7ae6-bcf9-731159986320	0199258e-2a3a-722e-88fe-e19dceafa723	owner	2025-09-07 19:01:38.392+00	2025-09-07 19:01:38.392+00
0199258e-2d3b-7804-a93f-e5ed7e587d60	0199258e-2d33-75db-9b3d-21d47aae6c2c	0199258e-2a3a-722e-88fe-e19dceafa723	owner	2025-09-07 19:01:38.747+00	2025-09-07 19:01:38.747+00
0199258e-e512-74c8-9f9d-d205e4738b8f	0199258e-e50a-7f60-8aad-64ca53ac3cf8	0199258e-e3f0-74df-b56a-8841ec9bcd35	owner	2025-09-07 19:02:25.81+00	2025-09-07 19:02:25.81+00
0199258e-e6a8-7a0f-a363-12f1e8e2abfc	0199258e-e6a0-7658-9e9b-809e686b04bc	0199258e-e3f0-74df-b56a-8841ec9bcd35	owner	2025-09-07 19:02:26.216+00	2025-09-07 19:02:26.216+00
0199258f-5de7-77a6-917c-74207f233afa	0199258f-5dde-7dc0-bef9-4e11c293c8cd	0199258f-5cb6-7998-b7db-d44c86f0149e	owner	2025-09-07 19:02:56.743+00	2025-09-07 19:02:56.743+00
0199258f-5efb-777a-a88b-f58456371fdd	0199258f-5ef3-7d3f-9436-f506791cad07	0199258f-5cb6-7998-b7db-d44c86f0149e	owner	2025-09-07 19:02:57.019+00	2025-09-07 19:02:57.019+00
01992590-a578-7119-8af6-167c35c3d728	01992590-a56f-760d-a90f-01f9750a7ab6	01992590-a15f-71af-a149-08f58d356bdb	owner	2025-09-07 19:04:20.6+00	2025-09-07 19:04:20.6+00
01992590-a6a5-789f-ad31-d93e87de0fa4	01992590-a6a2-7888-86e6-d4bf191ac1cf	01992590-a15f-71af-a149-08f58d356bdb	owner	2025-09-07 19:04:20.901+00	2025-09-07 19:04:20.901+00
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teams (id, organization_id, name, description, parent_team_id, team_type, created_at, updated_at, created_by) FROM stdin;
01920000-1002-7002-8002-000000000001	01920000-1000-7000-8000-000000000001	Development Team	Core software development team	\N	functional	2025-09-01 01:06:49.835238	2025-09-01 01:06:49.835238	0198b046-c453-72d9-b71a-092e1f75601a
01920000-1002-7002-8002-000000000002	01920000-1000-7000-8000-000000000001	Sales Team	Client acquisition and sales	\N	department	2025-09-01 01:06:49.835238	2025-09-01 01:06:49.835238	0198b046-c453-72d9-b71a-092e1f75601a
01920000-1002-7002-8002-000000000010	01920000-1000-7000-8000-000000000001	Marketing & Growth	Brand marketing, content, and growth strategies	\N	department	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000011	01920000-1000-7000-8000-000000000001	Operations	Internal operations, HR, and administration	\N	department	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000012	01920000-1000-7000-8000-000000000001	Finance & Legal	Financial planning, accounting, and legal affairs	\N	department	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000013	01920000-1000-7000-8000-000000000001	Frontend Team	React, Vue, and UI/UX development	01920000-1002-7002-8002-000000000001	functional	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000014	01920000-1000-7000-8000-000000000001	Backend Team	APIs, databases, and server infrastructure	01920000-1002-7002-8002-000000000001	functional	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000015	01920000-1000-7000-8000-000000000001	DevOps Team	CI/CD, cloud infrastructure, and monitoring	01920000-1002-7002-8002-000000000001	functional	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000016	01920000-1000-7000-8000-000000000001	Project Phoenix	Strategic initiative for platform modernization	\N	cross_functional	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
01920000-1002-7002-8002-000000000017	01920000-1000-7000-8000-000000000001	Customer Success	Client onboarding, support, and success	01920000-1002-7002-8002-000000000002	functional	2025-09-01 01:28:53.286745	2025-09-01 01:28:53.286745	\N
3137ec39-b01b-4226-bc46-f1da658646cf	01920000-1000-7000-8000-000000000001	Product Strategy Team	Product roadmap, user research, and strategic planning	\N	cross_functional	2025-09-01 01:35:31.706	2025-09-01 01:35:31.706	0198b046-c453-72d9-b71a-092e1f75601a
7d7c012f-0cb4-4d02-a7bf-30492db656fd	01920000-1000-7000-8000-000000000001	Customer Success Team	Client onboarding, support, and retention	\N	functional	2025-09-01 01:36:55.123	2025-09-01 01:36:55.123	0198b046-c453-72d9-b71a-092e1f75601a
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, organization_id, team_id, name, description, status, priority, project_type, start_date, target_completion_date, actual_completion_date, created_by, project_lead_id, created_at, updated_at) FROM stdin;
01920000-1003-7003-8003-000000000003	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000001	Client Project Alpha	Web development project for Client A	active	high	internal	\N	\N	\N	0198b046-c453-72d9-b71a-092e1f75601a	\N	2025-09-01 01:07:11.514655	2025-09-01 01:07:11.514655
01920000-1003-7003-8003-000000000004	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000002	Sales Pipeline Q4	Q4 sales targets and client outreach	active	critical	internal	\N	\N	\N	0198b046-c453-72d9-b71a-092e1f75601a	\N	2025-09-01 01:07:11.514655	2025-09-01 01:07:11.514655
01920000-1003-7003-8003-000000000020	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000013	Mobile App Development	iOS and Android app development for core platform	active	critical	internal	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000021	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000014	API Infrastructure	Core API services, microservices architecture	active	critical	internal	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000022	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000015	Cloud Infrastructure	AWS/Azure deployment, monitoring, and scaling	active	high	internal	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000025	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000010	Brand & Content Strategy	Brand positioning, content marketing, social media	active	high	internal	\N	\N	\N	01980000-2000-4000-8000-000000000014	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000026	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000002	Enterprise Sales Pipeline	B2B enterprise client acquisition and nurturing	active	critical	internal	\N	\N	\N	01980000-2000-4000-8000-000000000013	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000027	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000017	Customer Onboarding	New client setup, training, and success metrics	active	high	client_work	\N	\N	\N	01980000-2000-4000-8000-000000000016	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000030	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000011	HR & Talent Management	Recruiting, onboarding, performance management	active	medium	internal	\N	\N	\N	01980000-2000-4000-8000-000000000015	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000031	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000012	Financial Planning 2024	Budget planning, forecasting, and financial analysis	active	high	internal	\N	\N	\N	01980000-2000-4000-8000-000000000018	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000032	01920000-1000-7000-8000-000000000001	\N	Company All-Hands	Quarterly company meetings, announcements, culture	active	medium	internal	\N	\N	\N	0198b046-c453-72d9-b71a-092e1f75601a	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000035	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000016	Phoenix Platform Migration	Legacy system modernization and platform upgrade	active	critical	product	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000036	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000016	AI Integration Initiative	Machine learning and AI feature development	active	high	internal	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.301234	2025-09-01 01:28:53.301234
01920000-1003-7003-8003-000000000055	01920000-1000-7000-8000-000000000001	\N	Technical Architecture Research	New frameworks, architecture patterns, tech evaluation	active	high	personal	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000056	01920000-1000-7000-8000-000000000001	\N	Team Building & Mentoring	 1-on-1s, career development, team culture initiatives	active	high	personal	\N	\N	\N	01980000-2000-4000-8000-000000000017	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000060	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000013	UI/UX Design Learning	Design systems, accessibility, user research	active	medium	personal	\N	\N	\N	01980000-2000-4000-8000-000000000010	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000061	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000014	Database Optimization Project	PostgreSQL tuning, query optimization, performance	active	medium	personal	\N	\N	\N	01980000-2000-4000-8000-000000000011	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000062	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000015	Kubernetes Certification	CKA certification study, hands-on lab practice	active	medium	personal	\N	\N	\N	01980000-2000-4000-8000-000000000012	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000065	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000002	Sales Training & Development	Negotiation skills, CRM mastery, sales methodology	active	medium	personal	\N	\N	\N	01980000-2000-4000-8000-000000000013	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000066	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000010	Digital Marketing Experiments	A/B testing, growth hacking, analytics deep dives	active	medium	personal	\N	\N	\N	01980000-2000-4000-8000-000000000014	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000070	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000011	Process Automation Ideas	Workflow optimization, automation tools, efficiency	active	low	personal	\N	\N	\N	01980000-2000-4000-8000-000000000015	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
01920000-1003-7003-8003-000000000071	01920000-1000-7000-8000-000000000001	01920000-1002-7002-8002-000000000017	Customer Success Metrics	NPS tracking, churn analysis, success playbooks	active	high	personal	\N	\N	\N	01980000-2000-4000-8000-000000000016	\N	2025-09-01 01:28:53.303557	2025-09-01 01:28:53.303557
9490f5f8-a198-4f0a-8825-323ac7806d34	01920000-1000-7000-8000-000000000001	\N	Innovation Lab	Experimental projects and R&D initiatives	active	medium	internal	\N	\N	\N	0198b046-c453-72d9-b71a-092e1f75601a	\N	2025-09-01 01:36:22.254	2025-09-01 01:36:22.254
5c4ae277-a876-4a1d-b778-e2a1aa05df20	01920000-1000-7000-8000-000000000001	\N	Client Onboarding Process	Streamlined client onboarding workflows and documentation	active	high	client_work	\N	\N	\N	0198b046-c453-72d9-b71a-092e1f75601a	\N	2025-09-01 01:37:03.386	2025-09-01 01:37:03.386
\.


--
-- Data for Name: schema_metadata; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schema_metadata (key, value, updated_at) FROM stdin;
dataforge_version	1.0.0	2025-08-22 16:41:32.793459
legacy_cleanup_completed	1.0.0	2025-08-22 16:50:50.623508
entity_01920000-1000-7000-8000-000000000001_record_fields_modified	{"action":"add_fields","entityName":"record","addedFields":["title"],"timestamp":"2025-08-23T19:08:58.177Z"}	2025-08-23 15:08:58.177
entity_01920000-1000-7000-8000-000000000001_Client_fields_modified	{"action":"add_fields","entityName":"Client","addedFields":["test_cache_refresh"],"timestamp":"2025-08-25T14:29:59.548Z"}	2025-08-25 10:29:59.548
entity_01920000-1000-7000-8000-000000000001_SchemaTestEntity_fields_modified	{"action":"add_fields","entityName":"SchemaTestEntity","addedFields":["test_field"],"timestamp":"2025-09-03T13:16:45.110Z"}	2025-09-03 13:16:45.11
entity_01920000-1000-7000-8000-000000000001_TestProduct_fields_modified	{"action":"remove_field","entityName":"TestProduct","removedField":"brand","timestamp":"2025-09-07T15:42:24.382Z"}	2025-09-07 15:42:24.382
\.


--
-- Data for Name: secure_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.secure_config (key, encrypted_value, description, created_at, updated_at) FROM stdin;
JWT_SECRET	\\xc30d04070302d27ae31a602731c77fd25d01718f293550a9d9d49f26bdd3ac06c352477d3abee7d7ebab7c743311c04e98a488497797f740f4912cf11661c58049cad21964e56ab051853867028637a488fded854b92759a197070b7433590ea88c54fcdad65db6c6e25f037b153	JWT signing secret	2025-08-17 15:29:25.491203	2025-08-17 15:29:25.491203
NEON_API_KEY	\\xc30d04070302c598981457d1b4cc62d276017ce319b5137a2d879b7e5499b264467d6426ae2b75160c301b67b4c28a9c897a5428df9b0aac6fc4bb59c4cb06fea0516866fe58ccd2efa37672f266cc703c040def9b5601002146dadb0c2c0b518d4b913b60fbd72520481dc2f8f0c93665738331dfcc1abd3037aad7e20e59b5b7ffc53f210d32	Updated secret value	2025-08-17 15:29:25.474777	2025-08-17 15:37:04.4267
BETTER_AUTH_SECRET	\\xc30d04070302e02823f7d099eafc68d25d018cd9072b03a188f96c584fd502580fc152b6280fd1080ce1544d33249e39cecc70f8707998f5769a7097f42f07b1f7104ba04ade9a37c83261acb8977a2a31b615605b0c1938da0e10bb08779fdbd3a73794decdcb87b34581e5ce84	Updated secret value	2025-08-17 15:37:10.9611	2025-08-17 15:37:10.9611
BOOTSTRAP_SECRET	\\xc30d04070302c89734c01451e6fa74d27101b2c4cb38704414ad9f23bd9dd1c6cb18c05006b26120c7566b145288c5affa8e95704f9cdb2db0ba7a1abbd0934b245c59145f7cb37760525fdca3a236d2b52105cb6400193d69886ecf8c65c8d87212ed6e1118ff24849094443d39f222b6292ed7f9a85d1b16f8bb2bbcc048bf0924	Updated secret value	2025-08-17 15:37:17.67754	2025-08-17 15:37:17.67754
RESEND_API_KEY	\\xc30d040703027c153549a404d69f75d25501ef242937b09d1bbecff69f0f758fa218a9d7714972057af57714f983859d998401bec5e32b66377a26a29319b1639f0aef283cbd7f748f25b71e2a0d00af9cf5bf3d460e929845bf3fe0d9d9c9c797929c9c02fa	Updated secret value	2025-08-17 15:37:24.05755	2025-08-17 15:37:24.05755
POLAR_ACCESS_TOKEN	\\xc30d04070302fddb153e6f8422a77ed266014ed518020b597eca62d43df17d54222a31e674182f49f4c5db811110382023554d244bf91dcbe5ae42e9012026a25de6d12677f35033628dfaf579ba4a50b3dca2eb73dab7e16272d6e5fbb51a415a2a3dcd4b7f2952b3eea140fef913868b1a4b2ffb704e	Updated secret value	2025-08-17 15:37:32.063008	2025-08-17 15:37:32.063008
POLAR_WEBHOOK_SECRET	\\xc30d04070302bda814d6a8dac3e26cd277016c75f20b8e916bcf23f8947f615ad330248ca0f19065b542a57b04ff6d68c19e66555a9d8ee54ebfd385465c7d52877805904456f1d5aeef6f0db8698630e57594605af14866768a71f00b43e1ad3793ea5a4a8dd0025740238f8ac6ef268f1e464fc2f97110669ed5d7d2698e84ee0761315ac02c1a	Updated secret value	2025-08-17 15:37:39.262082	2025-08-17 15:37:39.262082
GITHUB_TOKEN	\\xc30d04070302145614aecb8892dd68d25801843703f286dfe9e52377e33379ddc90bb7dabe8ff29cc2d980d7bebdde53362c998c023924e93af33b32e17917fd009c96ac3b627582c278c2fde1de88517296873db1656f68303c01fa6e632e06f27f3bf88835ada234	Updated secret value	2025-08-17 15:29:25.483446	2025-08-17 15:37:51.306406
OPENAI_API_KEY	\\xc30d04070302d9e11cac6baab7216bd25c018f97c7c2fc379ec428649169050b6049d04edb85a505eb5bbf3f818569000ff333b6a24dd6421c204a7c06513fd219c904a534bab8b116e0ef30e5e43064022b3333a87c3582164525a5f9c372ffc121f5709d1e7c3ecfaa11dc46	Updated secret value	2025-08-17 15:29:25.485462	2025-08-17 15:37:56.38361
STRIPE_SECRET_KEY	\\xc30d0407030217685b109f6a67c862d261019f68ecc425c972609f6f6582330edc0d13a298a5e9bd75a907b89f9e974f5478edef50fdefae6340c6bda94b1ddf5ca3f8c5c0b1edf612c54aab5aba0722b638cd5a10536fb64fe300f2b09dfd803ab3f11c0a80d4b1da650571d7aa0cbed58c	Updated secret value	2025-08-17 15:29:25.48842	2025-08-17 15:38:02.779048
\.


--
-- Data for Name: subscription_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_limits (id, tier, limit_type, limit_value, limit_details, is_active, created_at, updated_at) FROM stdin;
2393b9b2-f5ed-49a9-8014-04e32e484b07	free	api_calls_per_month	1000	{"description": "API calls per month"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
2fc637f4-3ee7-4549-b36e-d3ca1bb11117	free	storage_gb	1	{"description": "Storage limit in GB"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
36d70bbb-a888-4254-a8f2-0ddd8d03e1f2	free	max_users	3	{"description": "Maximum organization members"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
f3c76781-daf7-4861-b87e-de25e92c3bca	free	max_projects	2	{"description": "Maximum projects"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
bf951b85-cdcd-4205-822c-b84863032ab0	free	max_tasks_per_project	50	{"description": "Maximum tasks per project"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
81f9ab0e-6ad8-474b-8a13-91480ddd9174	pro	api_calls_per_month	10000	{"description": "API calls per month"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
55ec751f-4d52-4cf3-b60f-207413e4a2f1	pro	storage_gb	50	{"description": "Storage limit in GB"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
29c832c7-a446-453e-9501-7399ce8603bd	pro	max_users	25	{"description": "Maximum organization members"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
eae5bbc6-166f-43ec-ac73-90e1763cd396	pro	max_projects	25	{"description": "Maximum projects"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
0c375a50-28c6-447a-96b2-fe532f4cc04c	pro	max_tasks_per_project	1000	{"description": "Maximum tasks per project"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
deefb8cc-2144-48aa-a5d7-a4a6c911bf24	enterprise	api_calls_per_month	100000	{"description": "API calls per month"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
179e2608-bbc9-42c3-af3e-3d014f0f222b	enterprise	storage_gb	500	{"description": "Storage limit in GB"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
cca42f55-c5ef-45a6-ac6f-4c488249e281	enterprise	max_users	500	{"description": "Maximum organization members"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
7e2e04a3-4e67-49a3-b33d-c7258b5ef989	enterprise	max_projects	500	{"description": "Maximum projects"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
9d0249dd-0fa8-4eea-9bb5-beeb4cd3b88b	enterprise	max_tasks_per_project	10000	{"description": "Maximum tasks per project"}	t	2025-08-14 21:26:57.784976	2025-08-14 21:26:57.784976
8514512f-112a-473c-b9eb-99582d42357f	trial	api_calls_per_month	50000	{"description": "API calls per month during trial"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
84e91bd7-1a03-42d2-b550-1e92c561cd4f	trial	storage_gb	10	{"description": "Storage limit in GB during trial"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
e30d3001-d976-4822-aaaa-fbfbe39ac93e	trial	max_users	25	{"description": "Maximum organization members during trial"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
df7bcff2-6af4-4722-a557-f9d2640c346f	trial	max_entities_total	-1	{"description": "Unlimited entities during trial (-1 = unlimited)"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
1dc53815-b154-4038-a4c9-e49dbe147fdd	trial	trial_days	14	{"description": "Trial period length in days"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
57a93457-3e56-408c-bfa4-79b2ce80d970	starter	api_calls_per_month	5000	{"description": "API calls per month"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
a34c09b8-1222-410e-bf99-c31f1fc7f073	starter	storage_gb	5	{"description": "Storage limit in GB"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
65e11425-4a92-4365-8634-eaf0c1012cd0	starter	max_users	3	{"description": "Maximum organization members"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
3ed48121-22d3-4f4d-bbbd-a9ff07cc8394	starter	max_entities_total	-1	{"description": "Unlimited entities (-1 = unlimited)"}	t	2025-08-15 16:02:28.101352	2025-08-15 16:02:28.101352
\.


--
-- Data for Name: system_option_sets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_option_sets (id, option_set_type, archetype, name, description, is_active, sort_order, created_at, updated_at) FROM stdin;
917c938e-2ff4-44eb-8907-f14d1b7dd5da	priority	project	Project Priority	Standard priority levels for projects	t	0	2025-08-25 15:11:17.010046	2025-08-25 15:11:17.010046
585b5a90-1c5a-4e60-8f4a-2d62c16f8449	status	project	Project Status	Standard status workflow for projects	t	0	2025-08-25 15:11:17.010046	2025-08-25 15:11:17.010046
12f64f25-9e2e-4666-ac38-73ec7498697d	category	project	Project Category	Standard project categories	t	0	2025-08-25 15:11:17.010046	2025-08-25 15:11:17.010046
7fca52f5-5cc0-49c8-9469-d913616136d1	priority	task	Task Priority	Standard priority levels for tasks	t	0	2025-08-25 15:11:17.013584	2025-08-25 15:11:17.013584
56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	status	task	Task Status	Standard status workflow for tasks	t	0	2025-08-25 15:11:17.013584	2025-08-25 15:11:17.013584
020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	category	task	Task Category	Standard task categories	t	0	2025-08-25 15:11:17.013584	2025-08-25 15:11:17.013584
fbd8b275-069e-4d93-843f-ac60c8c381f8	priority	record	Record Priority	Standard priority levels for records	t	0	2025-08-25 15:11:17.015033	2025-08-25 15:11:17.015033
48a46dd2-4dc0-4336-8a1b-339b12002cf1	status	record	Record Status	Standard status workflow for records	t	0	2025-08-25 15:11:17.015033	2025-08-25 15:11:17.015033
f7f43dee-8dcf-4c1f-8672-4447b16cd9e5	category	record	Record Category	Standard record categories	t	0	2025-08-25 15:11:17.015033	2025-08-25 15:11:17.015033
aaf26fa7-0a05-4ec5-b112-bfc52f965a03	status	document	Document Status	Standard status workflow for documents	t	0	2025-08-25 15:11:17.01632	2025-08-25 15:11:17.01632
f1c82c72-a505-416b-99cd-fb122ab8341a	category	document	Document Category	Standard document categories	t	0	2025-08-25 15:11:17.01632	2025-08-25 15:11:17.01632
f298467f-bd49-4704-b659-c1e7f2f931eb	status	file	File Status	Standard status workflow for files	t	0	2025-08-25 15:11:17.017497	2025-08-25 15:11:17.017497
e1359a68-9f82-4f48-8a0d-9d6813277c43	category	file	File Category	Standard file categories	t	0	2025-08-25 15:11:17.017497	2025-08-25 15:11:17.017497
c5ee4878-1724-4a9e-b2e0-98b0f9cea24c	status	activity	Activity Status	Standard status workflow for activities	t	0	2025-08-25 15:11:17.018834	2025-08-25 15:11:17.018834
25bcd8de-6ad0-4929-aa43-c1882708a542	category	activity	Activity Category	Standard activity categories	t	0	2025-08-25 15:11:17.018834	2025-08-25 15:11:17.018834
7a7e04b6-29f3-44a3-b632-7c2e80ac4225	status	discussion	Discussion Status	Standard status workflow for discussions	t	0	2025-08-25 15:11:17.020103	2025-08-25 15:11:17.020103
c0810212-e81c-49f5-913f-51a4347a8c4d	category	discussion	Discussion Category	Standard discussion categories	t	0	2025-08-25 15:11:17.020103	2025-08-25 15:11:17.020103
8d794551-0678-46cc-97ed-0ee48f35e3f8	status	collection	Collection Status	Standard status workflow for collections	t	0	2025-08-25 15:11:17.021356	2025-08-25 15:11:17.021356
bbd830a4-f32a-40d1-9986-447d97dabd8c	category	collection	Collection Category	Standard collection categories	t	0	2025-08-25 15:11:17.021356	2025-08-25 15:11:17.021356
\.


--
-- Data for Name: system_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_options (id, option_set_id, value, label, description, color, icon, is_active, sort_order, metadata, created_at, updated_at) FROM stdin;
76fa51ba-19ac-44dd-88c9-256bb0ce1ff9	917c938e-2ff4-44eb-8907-f14d1b7dd5da	low	Low Priority	Low priority projects	#22c55e	\N	t	1	{}	2025-08-25 15:11:17.022766	2025-08-25 15:11:17.022766
c092f496-0cb4-4162-b109-719577b3ae27	917c938e-2ff4-44eb-8907-f14d1b7dd5da	medium	Medium Priority	Medium priority projects	#f59e0b	\N	t	2	{}	2025-08-25 15:11:17.022766	2025-08-25 15:11:17.022766
6c531cfb-49db-4c2c-a485-93b695c03b02	917c938e-2ff4-44eb-8907-f14d1b7dd5da	high	High Priority	High priority projects	#ef4444	\N	t	3	{}	2025-08-25 15:11:17.022766	2025-08-25 15:11:17.022766
10317cc7-419f-4c1a-9adb-2166dac182a9	917c938e-2ff4-44eb-8907-f14d1b7dd5da	critical	Critical Priority	Critical priority projects	#dc2626	\N	t	4	{}	2025-08-25 15:11:17.022766	2025-08-25 15:11:17.022766
6a801a18-15f8-4678-9606-669b6b415530	585b5a90-1c5a-4e60-8f4a-2d62c16f8449	planning	Planning	Project in planning phase	#6b7280	\N	t	1	{}	2025-08-25 15:11:17.025747	2025-08-25 15:11:17.025747
c9f85a0e-e2ca-441e-8949-115fdd7d0ae8	585b5a90-1c5a-4e60-8f4a-2d62c16f8449	active	Active	Project is actively being worked on	#22c55e	\N	t	2	{}	2025-08-25 15:11:17.025747	2025-08-25 15:11:17.025747
aab3b4b5-a002-4e32-b726-5ca5d6e145f9	585b5a90-1c5a-4e60-8f4a-2d62c16f8449	on_hold	On Hold	Project is temporarily paused	#f59e0b	\N	t	3	{}	2025-08-25 15:11:17.025747	2025-08-25 15:11:17.025747
db3e6ac9-2c85-4133-a728-f3698f73e502	585b5a90-1c5a-4e60-8f4a-2d62c16f8449	completed	Completed	Project has been completed	#10b981	\N	t	4	{}	2025-08-25 15:11:17.025747	2025-08-25 15:11:17.025747
bcaf867e-3a79-4c2b-b932-6f80fdab3eaf	585b5a90-1c5a-4e60-8f4a-2d62c16f8449	cancelled	Cancelled	Project has been cancelled	#ef4444	\N	t	5	{}	2025-08-25 15:11:17.025747	2025-08-25 15:11:17.025747
867aadbe-73c6-4e6a-8d5b-406016559496	12f64f25-9e2e-4666-ac38-73ec7498697d	software	Software Development	Software development projects	\N	\N	t	1	{}	2025-08-25 15:11:17.027871	2025-08-25 15:11:17.027871
d2edddeb-8b31-45d7-8552-0513061d6cd9	12f64f25-9e2e-4666-ac38-73ec7498697d	research	Research	Research and development projects	\N	\N	t	2	{}	2025-08-25 15:11:17.027871	2025-08-25 15:11:17.027871
e1f8eee6-b3fc-4455-b083-75d263de715a	12f64f25-9e2e-4666-ac38-73ec7498697d	marketing	Marketing	Marketing and promotional projects	\N	\N	t	3	{}	2025-08-25 15:11:17.027871	2025-08-25 15:11:17.027871
818d340b-3a4a-4381-addc-cb25a1697ae0	12f64f25-9e2e-4666-ac38-73ec7498697d	operational	Operational	Operational improvement projects	\N	\N	t	4	{}	2025-08-25 15:11:17.027871	2025-08-25 15:11:17.027871
6e01fbf6-ceb8-497f-b114-dec663895660	12f64f25-9e2e-4666-ac38-73ec7498697d	strategic	Strategic	Strategic business projects	\N	\N	t	5	{}	2025-08-25 15:11:17.027871	2025-08-25 15:11:17.027871
46898393-ef95-4054-8831-77bae57047a1	7fca52f5-5cc0-49c8-9469-d913616136d1	low	Low Priority	Low priority tasks	#22c55e	\N	t	1	{}	2025-08-25 15:11:17.029451	2025-08-25 15:11:17.029451
df37281e-292d-440c-bed7-8133660e9088	7fca52f5-5cc0-49c8-9469-d913616136d1	medium	Medium Priority	Medium priority tasks	#f59e0b	\N	t	2	{}	2025-08-25 15:11:17.029451	2025-08-25 15:11:17.029451
917ee647-3c9a-490c-b87c-fcf9b9ecc59c	7fca52f5-5cc0-49c8-9469-d913616136d1	high	High Priority	High priority tasks	#ef4444	\N	t	3	{}	2025-08-25 15:11:17.029451	2025-08-25 15:11:17.029451
8a26d182-9002-4a17-87ac-d5976803bb8d	7fca52f5-5cc0-49c8-9469-d913616136d1	critical	Critical Priority	Critical priority tasks	#dc2626	\N	t	4	{}	2025-08-25 15:11:17.029451	2025-08-25 15:11:17.029451
d4df2550-2a39-47c7-b19f-069e8b14a59d	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	backlog	Backlog	Task is in backlog	#6b7280	\N	t	1	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
abebc6aa-2893-43c5-a680-e42ecd2fd1c8	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	todo	To Do	Task is ready to start	#3b82f6	\N	t	2	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
e08f20b3-b46a-48eb-bdcc-b39e4d60d2c3	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	in_progress	In Progress	Task is being worked on	#f59e0b	\N	t	3	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
9275072b-7eac-4228-9027-86cb4848d2cb	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	review	In Review	Task is under review	#8b5cf6	\N	t	4	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
69991fec-1c53-4e69-9f2a-dffc974476b9	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	testing	Testing	Task is being tested	#06b6d4	\N	t	5	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
3bc81d34-7953-4bb2-99d5-eb15c187f746	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	done	Done	Task is completed	#10b981	\N	t	6	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
406b323e-1754-4f37-9a23-de3c4dd07b27	56a6b735-184a-4dc3-8f0b-9d0bfe6ad152	blocked	Blocked	Task is blocked	#ef4444	\N	t	7	{}	2025-08-25 15:11:17.03121	2025-08-25 15:11:17.03121
6624c9b3-5319-4662-9ca9-1562b7dc7c3f	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	feature	Feature	New feature development	\N	\N	t	1	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
93559342-bf64-47d4-951c-207b1dee5b62	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	bug_fix	Bug Fix	Bug fixes and corrections	\N	\N	t	2	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
0cb91f85-3199-4f17-81fd-176a470b9b9c	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	research	Research	Research and investigation tasks	\N	\N	t	3	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
9db44a4b-d515-481c-9f16-d229d9efddc6	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	documentation	Documentation	Documentation tasks	\N	\N	t	4	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
af2077bf-4d31-4e25-b4bf-86785057f381	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	testing	Testing	Testing and QA tasks	\N	\N	t	5	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
41bb0cd7-a50f-4f0b-8cea-f61b3d004502	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	deployment	Deployment	Deployment and release tasks	\N	\N	t	6	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
bb2d7995-a867-4836-8833-2c5ce5888cf7	020cfacd-eb8d-4dd6-a207-99a8c6a4f9e9	meeting	Meeting	Meeting and discussion tasks	\N	\N	t	7	{}	2025-08-25 15:11:17.033454	2025-08-25 15:11:17.033454
d58c60b6-e255-40da-a21d-cfb4d538fe89	fbd8b275-069e-4d93-843f-ac60c8c381f8	low	Low	Low priority item	#10B981	\N	t	10	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
169480ca-5981-44e9-8df4-6c5cd685d3a0	fbd8b275-069e-4d93-843f-ac60c8c381f8	medium	Medium	Medium priority item	#F59E0B	\N	t	20	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
2184e69e-8fd7-4f52-bbb5-d834e546743b	fbd8b275-069e-4d93-843f-ac60c8c381f8	high	High	High priority item	#F97316	\N	t	30	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
637249b9-31b4-4db2-aae9-d519ec1731e0	fbd8b275-069e-4d93-843f-ac60c8c381f8	critical	Critical	Critical priority item	#EF4444	\N	t	40	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
671518e0-f59e-47d3-8469-24e7ff9102aa	48a46dd2-4dc0-4336-8a1b-339b12002cf1	active	Active	Active and operational	#10B981	\N	t	10	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
981b4954-630d-4e51-91b2-6084f4963545	48a46dd2-4dc0-4336-8a1b-339b12002cf1	inactive	Inactive	Currently inactive	#6B7280	\N	t	20	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
39bc1b5b-4d4b-40a5-a2a9-b7b81ff61382	48a46dd2-4dc0-4336-8a1b-339b12002cf1	pending	Pending	Awaiting action or approval	#F59E0B	\N	t	30	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
3083ae21-a3d1-4abc-a158-b4a55c426dd8	48a46dd2-4dc0-4336-8a1b-339b12002cf1	on_hold	On Hold	Temporarily on hold	#8B5CF6	\N	t	40	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
af61b385-a09a-4f8d-83d7-1e9e285ab9e0	48a46dd2-4dc0-4336-8a1b-339b12002cf1	archived	Archived	Archived for reference	#6B7280	\N	t	50	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
3ddcc765-046f-4266-94eb-15b2e208ce1f	48a46dd2-4dc0-4336-8a1b-339b12002cf1	deleted	Deleted	Marked for deletion	#EF4444	\N	t	60	{}	2025-08-25 18:52:57.062386	2025-08-25 18:52:57.062386
\.


--
-- Data for Name: team_memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_memberships (id, team_id, user_id, role, created_at, created_by) FROM stdin;
b3692995-981b-4f00-a506-51bcd7a7e661	01920000-1002-7002-8002-000000000001	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:06:55.376752	\N
4a9b4c34-f20f-4f57-9449-f8b4bc108a19	01920000-1002-7002-8002-000000000002	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:06:55.376752	\N
01950000-4000-6000-8000-000000000010	01920000-1002-7002-8002-000000000010	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000011	01920000-1002-7002-8002-000000000011	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000012	01920000-1002-7002-8002-000000000012	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000020	01920000-1002-7002-8002-000000000001	01980000-2000-4000-8000-000000000017	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000021	01920000-1002-7002-8002-000000000013	01980000-2000-4000-8000-000000000017	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000022	01920000-1002-7002-8002-000000000014	01980000-2000-4000-8000-000000000017	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000023	01920000-1002-7002-8002-000000000015	01980000-2000-4000-8000-000000000017	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000030	01920000-1002-7002-8002-000000000013	01980000-2000-4000-8000-000000000010	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000031	01920000-1002-7002-8002-000000000014	01980000-2000-4000-8000-000000000011	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000032	01920000-1002-7002-8002-000000000015	01980000-2000-4000-8000-000000000012	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000040	01920000-1002-7002-8002-000000000002	01980000-2000-4000-8000-000000000013	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000041	01920000-1002-7002-8002-000000000010	01980000-2000-4000-8000-000000000014	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000050	01920000-1002-7002-8002-000000000011	01980000-2000-4000-8000-000000000015	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000051	01920000-1002-7002-8002-000000000017	01980000-2000-4000-8000-000000000016	lead	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000060	01920000-1002-7002-8002-000000000016	01980000-2000-4000-8000-000000000017	admin	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000061	01920000-1002-7002-8002-000000000016	01980000-2000-4000-8000-000000000010	member	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000062	01920000-1002-7002-8002-000000000016	01980000-2000-4000-8000-000000000011	member	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000063	01920000-1002-7002-8002-000000000016	01980000-2000-4000-8000-000000000012	member	2025-09-01 01:28:53.29968	\N
01950000-4000-6000-8000-000000000064	01920000-1002-7002-8002-000000000016	01980000-2000-4000-8000-000000000014	member	2025-09-01 01:28:53.29968	\N
97448cab-0f65-44db-a23c-d54d4d081882	3137ec39-b01b-4226-bc46-f1da658646cf	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:35:31.709	0198b046-c453-72d9-b71a-092e1f75601a
c1131c0c-2917-4cae-986b-385cac923681	7d7c012f-0cb4-4d02-a7bf-30492db656fd	0198b046-c453-72d9-b71a-092e1f75601a	admin	2025-09-01 01:36:55.125	0198b046-c453-72d9-b71a-092e1f75601a
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
0198b838-9bf2-7a45-a2ea-7551625a3505	reset-password:vVuNxrb89cdJWHGiUhudtXIV	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 10:29:34.449	2025-08-17 09:29:34.449	2025-08-17 09:29:34.449
0198b838-a6cd-7be8-851d-e596bc78834b	reset-password:Sj4BQoOLs8xXxz2oAlsyafX1	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 10:29:37.228	2025-08-17 09:29:37.229	2025-08-17 09:29:37.229
0198b838-b14b-7ce1-acd8-dc7fb085d603	reset-password:L6Y53N5e66HvBnVnxWWdOaXi	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 10:29:39.915	2025-08-17 09:29:39.915	2025-08-17 09:29:39.915
0198b839-91fb-7f2e-899e-d76e7b92dc8f	reset-password:XF0p0dMVG315J4XpfPYu7rd2	0198b046-c453-72d9-b71a-092e1f75601a	2025-08-17 10:30:37.435	2025-08-17 09:30:37.435	2025-08-17 09:30:37.435
0198b839-9af6-7001-9c89-1d753d2de43a	reset-password:APHkQD0DMyqiRWQokUTDu2Qm	0198b046-d127-769d-9bc2-8e5824b71b3a	2025-08-17 10:30:39.734	2025-08-17 09:30:39.734	2025-08-17 09:30:39.734
0198b839-a325-778d-8a14-9085e38e9d23	reset-password:UugKX0mya2rwkd0L3W6MtZ55	0198b046-d931-7772-a1e8-b63c68c7f43d	2025-08-17 10:30:41.829	2025-08-17 09:30:41.829	2025-08-17 09:30:41.829
\.


--
-- PostgreSQL database dump complete
--

\unrestrict qIN8eF2jLQ499rB2aNECU9sei9QsAoPwG7kT9P5JTZE7GA0yy6KgeW8jvEPsp84

