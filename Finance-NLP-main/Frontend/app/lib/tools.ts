export const getHackathonInfo = {
  name: "getHackathonInfo",
  description: "Get information about the world's shortest hackathon",
  parameters: {},
  execute: async () => {
    // Mock data
    return { attendees: 1000 }
  },
}

export const tools = [getHackathonInfo]

