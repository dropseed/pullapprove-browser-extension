import React from "react";
import { Flex, Box, Text, StyledOcticon, Avatar } from "@primer/components";
import { CheckIcon, DotFillIcon, XIcon } from "@primer/octicons-react";

const SuccessIcon = (props) => (
  <StyledOcticon icon={CheckIcon} color="state.success" size={props.size} />
);
const PendingIcon = (props) => (
  <StyledOcticon icon={DotFillIcon} color="state.pending" size={props.size} />
);
const RejectedIcon = (props) => (
  <StyledOcticon icon={XIcon} color="state.failure" size={props.size} />
);

const User = (props) => (
  <Flex alignContent="center" justifyContent="space-between" mt={2}>
    <Flex alignContent="center">
      <Avatar
        src={`${window.location.origin}/${props.username}.png`}
        size={20}
      />
      <Text
        ml={1}
        fontWeight={props.username === props.currentUsername ? "bold" : ""}
      >
        {props.username}
      </Text>
    </Flex>
    {props.icon}
  </Flex>
);

export default class Group extends React.Component {
  render() {
    const { name, data, currentUsername } = this.props;
    return (
      <Box mb="3">
        <Flex alignContent="center" justifyContent="space-between">
          <div className="text-bold">{name}</div>
          <div>
            <Text mr={1}>
              {data.score}/{data.required}
            </Text>
            {data.is_passing ? <SuccessIcon /> : <PendingIcon />}
          </div>
        </Flex>
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
      </Box>
    );
  }
}
