import React from "react";

const SuccessIcon = () => (
  <span style={{ color: "green", fontSize: "1.5em" }}>
    <svg
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="16"
      height="16"
    >
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
    </svg>
  </span>
);
const PendingIcon = () => (
  <span style={{ color: "orange", fontSize: "1.5em" }}>
    <svg
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="16"
      height="16"
    >
      <path d="M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"></path>
    </svg>
  </span>
);
const RejectedIcon = () => (
  <span style={{ color: "red", fontSize: "1.5em" }}>
    <svg
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="16"
      height="16"
    >
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
    </svg>
  </span>
);

const User = (props) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: "8px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center" }}>
      <img
        src={`${window.location.origin}/${props.username}.png`}
        alt={props.username}
        style={{ width: "20px", height: "20px", borderRadius: "50%" }}
      />
      <span
        style={{
          marginLeft: "4px",
          fontWeight:
            props.username === props.currentUsername ? "bold" : "normal",
        }}
      >
        {props.username}
      </span>
    </div>
    {props.icon}
  </div>
);

export default class Group extends React.Component {
  render() {
    const { name, data, currentUsername } = this.props;
    return (
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <code style={{ fontWeight: "bold" }}>{name}</code>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ marginRight: "8px" }}>
              {data.score}/{data.required}
            </span>
            {data.is_passing ? <SuccessIcon /> : <PendingIcon />}
          </div>
        </div>
        {data.users_approved.map((username) => (
          <User
            key={username}
            currentUsername={currentUsername}
            username={username}
            icon={<SuccessIcon />}
          />
        ))}
        {data.users_pending.map((username) => (
          <User
            key={username}
            currentUsername={currentUsername}
            username={username}
            icon={<PendingIcon />}
          />
        ))}
        {data.users_rejected.map((username) => (
          <User
            key={username}
            currentUsername={currentUsername}
            username={username}
            icon={<RejectedIcon />}
          />
        ))}
      </div>
    );
  }
}
