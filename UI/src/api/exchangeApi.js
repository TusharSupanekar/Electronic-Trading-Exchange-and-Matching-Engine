import client from "./client";

export const loginUser = async (data) => {
  const response = await client.post("/login", data);
  return response.data;
};

export const registerUser = async (data) => {
  const response = await client.post("/register", data);
  return response.data;
};
