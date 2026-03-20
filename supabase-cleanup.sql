-- 一次性清理舊的混雜資料
-- 請在 Supabase SQL Editor 手動執行需要的區塊。
-- 執行前，建議先匯出或備份資料。

-- 1. 檢查目前各資料表的 user_id 分布
select 'medications' as table_name, user_id, count(*) as row_count
from medications
group by user_id
union all
select 'weights' as table_name, user_id, count(*) as row_count
from weights
group by user_id
union all
select 'labs' as table_name, user_id, count(*) as row_count
from labs
group by user_id
union all
select 'inbody' as table_name, user_id, count(*) as row_count
from inbody
group by user_id
order by table_name, user_id;

-- 2. 檢查 auth 使用者與 email 對應
select id, email, created_at
from auth.users
order by created_at;

-- 3. 刪除 user_id 為空的舊資料
delete from medications where user_id is null;
delete from weights where user_id is null;
delete from labs where user_id is null;
delete from inbody where user_id is null;

-- 4. 如果你要清空某一個帳號的所有資料，將下面 email 改成目標帳號後執行
-- 這適合在舊 shared policy 混用期間，資料已混在某一個帳號底下的情況。

-- delete from medications
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- );

-- delete from weights
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- );

-- delete from labs
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- );

-- delete from inbody
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- );

-- 5. 如果你只想看某個帳號目前有哪些資料，可先用這些查詢確認

-- select * from medications
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- )
-- order by date desc, time desc;

-- select * from weights
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- )
-- order by date desc, time desc;

-- select * from labs
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- )
-- order by date desc;

-- select * from inbody
-- where user_id = (
--   select id from auth.users where email = 'your-email@example.com'
-- )
-- order by date desc;
