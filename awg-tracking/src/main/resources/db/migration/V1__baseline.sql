-- Baseline schema (generated from the JPA entities with Hibernate on PostgreSQL, 2026-11-05).
-- From now on change the schema only with new V<n>__*.sql migrations.



CREATE TABLE customer (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(255) NOT NULL
);

CREATE TABLE inventory (
    quantity integer NOT NULL,
    id uuid NOT NULL,
    custom_color character varying(255),
    item_kind character varying(255) NOT NULL,
    CONSTRAINT inventory_custom_color_check CHECK (((custom_color)::text = ANY ((ARRAY['RED'::character varying, 'GREY'::character varying, 'GREEN'::character varying, 'WHITE'::character varying])::text[]))),
    CONSTRAINT inventory_item_kind_check CHECK (((item_kind)::text = ANY ((ARRAY['CUSTOM'::character varying, 'GENERIC'::character varying])::text[])))
);

CREATE TABLE market (
    finish_date date,
    stall integer,
    start_date date,
    total_cost numeric(10,2) NOT NULL,
    id uuid NOT NULL,
    kind character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    CONSTRAINT market_kind_check CHECK (((kind)::text = ANY ((ARRAY['MARKET'::character varying, 'HOME'::character varying])::text[])))
);

CREATE TABLE market_day (
    close_time time(0) without time zone NOT NULL,
    date date NOT NULL,
    open_time time(0) without time zone NOT NULL,
    id uuid NOT NULL,
    market_id uuid NOT NULL
);

CREATE TABLE order_item (
    cost numeric(10,2) NOT NULL,
    handoff_date date NOT NULL,
    pick_up_time time(0) without time zone,
    "position" integer NOT NULL,
    with_name boolean NOT NULL,
    paint_end timestamp(6) without time zone,
    paint_start timestamp(6) without time zone,
    id uuid NOT NULL,
    inventory_id uuid,
    order_id uuid NOT NULL,
    sold_on_day_id uuid,
    note character varying(1000),
    custom_color character varying(255),
    delivery_kind character varying(255) NOT NULL,
    item_kind character varying(255) NOT NULL,
    name_in_ornament character varying(255),
    pet_name character varying(255),
    production_status character varying(255) NOT NULL,
    CONSTRAINT order_item_custom_color_check CHECK (((custom_color)::text = ANY ((ARRAY['RED'::character varying, 'GREY'::character varying, 'GREEN'::character varying, 'WHITE'::character varying])::text[]))),
    CONSTRAINT order_item_delivery_kind_check CHECK (((delivery_kind)::text = ANY ((ARRAY['MARKET'::character varying, 'DELIVERY'::character varying])::text[]))),
    CONSTRAINT order_item_item_kind_check CHECK (((item_kind)::text = ANY ((ARRAY['CUSTOM'::character varying, 'GENERIC'::character varying])::text[]))),
    CONSTRAINT order_item_production_status_check CHECK (((production_status)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'IN_PROGRESS'::character varying, 'FINISHED'::character varying])::text[])))
);

CREATE TABLE order_item_photos (
    "position" integer NOT NULL,
    order_item_id uuid NOT NULL,
    photo_id uuid NOT NULL,
    photo_name character varying(255) NOT NULL,
    CONSTRAINT order_item_photos_position_check CHECK (("position" >= 0))
);

CREATE TABLE orders (
    delivery_fee numeric(10,2),
    form_submitted boolean NOT NULL,
    handed_over boolean NOT NULL,
    total numeric(10,2) NOT NULL,
    checkout_expires_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone NOT NULL,
    customer_id uuid NOT NULL,
    id uuid NOT NULL,
    address_city character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    address_postal_code character varying(255),
    checkout_status character varying(255),
    code character varying(255) NOT NULL,
    form_token character varying(255) NOT NULL,
    payment_method character varying(255),
    payment_state character varying(255) NOT NULL,
    source character varying(255),
    stripe_session_id character varying(255),
    CONSTRAINT orders_checkout_status_check CHECK (((checkout_status)::text = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying])::text[]))),
    CONSTRAINT orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['CASH'::character varying, 'CARD'::character varying])::text[]))),
    CONSTRAINT orders_payment_state_check CHECK (((payment_state)::text = ANY ((ARRAY['UNPAID'::character varying, 'DEPOSIT'::character varying, 'PAID'::character varying])::text[]))),
    CONSTRAINT orders_source_check CHECK (((source)::text = ANY ((ARRAY['STALL'::character varying, 'WEB'::character varying])::text[])))
);

CREATE TABLE schedule_lock (
    id bigint NOT NULL
);

CREATE TABLE staff_session (
    created_at timestamp(6) with time zone NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    id uuid NOT NULL,
    staff_user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL
);

CREATE TABLE staff_user (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL
);

CREATE TABLE stored_photo (
    created_at timestamp(6) with time zone NOT NULL,
    size_bytes bigint NOT NULL,
    id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    content_type character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    storage_key character varying(255) NOT NULL
);

ALTER TABLE ONLY customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);

ALTER TABLE ONLY inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);

ALTER TABLE ONLY market_day
    ADD CONSTRAINT market_day_pkey PRIMARY KEY (id);

ALTER TABLE ONLY market
    ADD CONSTRAINT market_pkey PRIMARY KEY (id);

ALTER TABLE ONLY order_item_photos
    ADD CONSTRAINT order_item_photos_pkey PRIMARY KEY ("position", order_item_id);

ALTER TABLE ONLY order_item
    ADD CONSTRAINT order_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY orders
    ADD CONSTRAINT orders_code_key UNIQUE (code);

ALTER TABLE ONLY orders
    ADD CONSTRAINT orders_form_token_key UNIQUE (form_token);

ALTER TABLE ONLY orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY orders
    ADD CONSTRAINT orders_stripe_session_id_key UNIQUE (stripe_session_id);

ALTER TABLE ONLY schedule_lock
    ADD CONSTRAINT schedule_lock_pkey PRIMARY KEY (id);

ALTER TABLE ONLY staff_session
    ADD CONSTRAINT staff_session_pkey PRIMARY KEY (id);

ALTER TABLE ONLY staff_session
    ADD CONSTRAINT staff_session_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY staff_user
    ADD CONSTRAINT staff_user_email_key UNIQUE (email);

ALTER TABLE ONLY staff_user
    ADD CONSTRAINT staff_user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY stored_photo
    ADD CONSTRAINT stored_photo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY stored_photo
    ADD CONSTRAINT stored_photo_storage_key_key UNIQUE (storage_key);

ALTER TABLE ONLY market_day
    ADD CONSTRAINT uk_market_day_market_date UNIQUE (market_id, date);

ALTER TABLE ONLY orders
    ADD CONSTRAINT fk624gtjin3po807j3vix093tlf FOREIGN KEY (customer_id) REFERENCES customer(id);

ALTER TABLE ONLY order_item
    ADD CONSTRAINT fkbe88pa07xcglfyjv9nybeo08o FOREIGN KEY (sold_on_day_id) REFERENCES market_day(id);

ALTER TABLE ONLY staff_session
    ADD CONSTRAINT fkensnk4s7eiufbqt5v015sqqvj FOREIGN KEY (staff_user_id) REFERENCES staff_user(id);

ALTER TABLE ONLY market_day
    ADD CONSTRAINT fkgu4uwtq0isirih23u0y37sp0g FOREIGN KEY (market_id) REFERENCES market(id);

ALTER TABLE ONLY order_item_photos
    ADD CONSTRAINT fkkqmiysjavok4ompa2na5l65aa FOREIGN KEY (order_item_id) REFERENCES order_item(id);

ALTER TABLE ONLY order_item
    ADD CONSTRAINT fkq5fateg3fprnc9muagexcjb FOREIGN KEY (inventory_id) REFERENCES inventory(id);

ALTER TABLE ONLY order_item
    ADD CONSTRAINT fkt4dc2r9nbvbujrljv3e23iibt FOREIGN KEY (order_id) REFERENCES orders(id);


