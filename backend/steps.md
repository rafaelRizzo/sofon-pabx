docker exec -it postgres_rafael psql -U postgres

\c asterisk

ALTER TABLE extensions OWNER TO asterisk;
ALTER TABLE ps_aors OWNER TO asterisk;
ALTER TABLE ps_auths OWNER TO asterisk;
ALTER TABLE ps_contacts OWNER TO asterisk;
ALTER TABLE ps_endpoints OWNER TO asterisk;
ALTER TABLE sip_peers OWNER TO asterisk;
ALTER TABLE voicemail_users OWNER TO asterisk;
ALTER TABLE queues OWNER TO asterisk;
ALTER TABLE queue_member OWNER TO asterisk;