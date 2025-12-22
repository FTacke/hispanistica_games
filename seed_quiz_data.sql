-- Seed quiz topics and questions for development
-- Run with: Get-Content seed_quiz_data.sql | docker exec -i hispanistica_auth_db psql -U hispanistica_auth

-- Insert test topic
INSERT INTO quiz_topics (id, title_key, description_key, is_active, order_index, created_at) 
VALUES ('test_topic', 'topics.test.title', 'topics.test.description', true, 1, NOW()) 
ON CONFLICT (id) DO NOTHING;

-- Insert test questions (5 difficulties, 2 per level)
INSERT INTO quiz_questions (id, topic_id, difficulty, type, prompt_key, explanation_key, answers, is_active, created_at) VALUES
('test_q1_1', 'test_topic', 1, 'single_choice', 'questions.test_q1_1.prompt', 'questions.test_q1_1.explanation', 
 '[{"id": 1, "text_key": "questions.test_q1_1.a1", "correct": true}, 
   {"id": 2, "text_key": "questions.test_q1_1.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q1_1.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q1_1.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q1_2', 'test_topic', 1, 'single_choice', 'questions.test_q1_2.prompt', 'questions.test_q1_2.explanation', 
 '[{"id": 1, "text_key": "questions.test_q1_2.a1", "correct": true}, 
   {"id": 2, "text_key": "questions.test_q1_2.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q1_2.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q1_2.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q2_1', 'test_topic', 2, 'single_choice', 'questions.test_q2_1.prompt', 'questions.test_q2_1.explanation', 
 '[{"id": 1, "text_key": "questions.test_q2_1.a1", "correct": false}, 
   {"id": 2, "text_key": "questions.test_q2_1.a2", "correct": true}, 
   {"id": 3, "text_key": "questions.test_q2_1.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q2_1.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q2_2', 'test_topic', 2, 'single_choice', 'questions.test_q2_2.prompt', 'questions.test_q2_2.explanation', 
 '[{"id": 1, "text_key": "questions.test_q2_2.a1", "correct": false}, 
   {"id": 2, "text_key": "questions.test_q2_2.a2", "correct": true}, 
   {"id": 3, "text_key": "questions.test_q2_2.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q2_2.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q3_1', 'test_topic', 3, 'single_choice', 'questions.test_q3_1.prompt', 'questions.test_q3_1.explanation', 
 '[{"id": 1, "text_key": "questions.test_q3_1.a1", "correct": false}, 
   {"id": 2, "text_key": "questions.test_q3_1.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q3_1.a3", "correct": true}, 
   {"id": 4, "text_key": "questions.test_q3_1.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q3_2', 'test_topic', 3, 'single_choice', 'questions.test_q3_2.prompt', 'questions.test_q3_2.explanation', 
 '[{"id": 1, "text_key": "questions.test_q3_2.a1", "correct": false}, 
   {"id": 2, "text_key": "questions.test_q3_2.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q3_2.a3", "correct": true}, 
   {"id": 4, "text_key": "questions.test_q3_2.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q4_1', 'test_topic', 4, 'single_choice', 'questions.test_q4_1.prompt', 'questions.test_q4_1.explanation', 
 '[{"id": 1, "text_key": "questions.test_q4_1.a1", "correct": false}, 
   {"id": 2, "text_key": "questions.test_q4_1.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q4_1.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q4_1.a4", "correct": true}]'::jsonb, true, NOW()),
   
('test_q4_2', 'test_topic', 4, 'single_choice', 'questions.test_q4_2.prompt', 'questions.test_q4_2.explanation', 
 '[{"id": 1, "text_key": "questions.test_q4_2.a1", "correct": false}, 
   {"id": 2, "text_key": "questions.test_q4_2.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q4_2.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q4_2.a4", "correct": true}]'::jsonb, true, NOW()),
   
('test_q5_1', 'test_topic', 5, 'single_choice', 'questions.test_q5_1.prompt', 'questions.test_q5_1.explanation', 
 '[{"id": 1, "text_key": "questions.test_q5_1.a1", "correct": true}, 
   {"id": 2, "text_key": "questions.test_q5_1.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q5_1.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q5_1.a4", "correct": false}]'::jsonb, true, NOW()),
   
('test_q5_2', 'test_topic', 5, 'single_choice', 'questions.test_q5_2.prompt', 'questions.test_q5_2.explanation', 
 '[{"id": 1, "text_key": "questions.test_q5_2.a1", "correct": true}, 
   {"id": 2, "text_key": "questions.test_q5_2.a2", "correct": false}, 
   {"id": 3, "text_key": "questions.test_q5_2.a3", "correct": false}, 
   {"id": 4, "text_key": "questions.test_q5_2.a4", "correct": false}]'::jsonb, true, NOW())
ON CONFLICT (id) DO NOTHING;
