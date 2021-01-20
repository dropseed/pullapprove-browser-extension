import React from "react";

// @primer stuff doesn't seem to do dark mode... so these are just classes that match github.com
const flashClass = {
  success: "flash flash-success",
  pending: "flash flash-warn",
  failure: "flash flash-error",
  error: "flash flash-error",
};

export default class Status extends React.Component {
  render() {
    const { state, explanation } = this.props;
    return <div className={`${flashClass[state]} p-2 mb-3`}>{explanation}</div>;
  }
}
