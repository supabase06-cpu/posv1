import { supabase } from './supabase'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
  store_id: string
  role: 'admin' | 'manager' | 'cashier' | 'inventory'
  first_name: string | null
  last_name: string | null
  is_active: boolean
}

export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export const loginUser = async (email: string, password: string) => {
  try {
    // Step 1: Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Supabase auth error:', error.message)
      return { success: false, error: error.message }
    }

    if (!data.user) {
      return { success: false, error: 'No user returned from auth' }
    }

    // Step 2: Fetch user details from auth_users table using email as fallback
    let userDetails: any = null
    let userError: any = null

    // Try to fetch by ID first
    const { data: userById, error: errorById } = await supabase
      .from('auth_users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    if (errorById && errorById.code !== 'PGRST116') {
      console.error('Error fetching user by ID:', errorById.message)
      userError = errorById
    } else if (userById) {
      userDetails = userById
    } else {
      // If not found by ID, try by email
      const { data: userByEmail, error: errorByEmail } = await supabase
        .from('auth_users')
        .select('*')
        .eq('email', data.user.email)
        .maybeSingle()

      if (errorByEmail) {
        console.error('Error fetching user by email:', errorByEmail.message)
        userError = errorByEmail
      } else if (userByEmail) {
        userDetails = userByEmail
      }
    }

    // If user not found, create entry
    if (!userDetails && !userError) {
      const { error: insertError } = await (supabase
        .from('auth_users')
        .insert([
          {
            id: data.user.id,
            email: data.user.email,
            store_id: 'store-001',
            role: 'cashier',
            first_name: null,
            last_name: null,
            is_active: true,
          },
        ] as any) as any)

      if (insertError) {
        console.error('Error creating user entry:', insertError.message)
        return { success: false, error: 'Failed to create user profile' }
      }

      // Fetch the newly created user
      const { data: newUser, error: fetchError } = await supabase
        .from('auth_users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      if (fetchError || !newUser) {
        console.error('Error fetching new user:', fetchError?.message)
        return { success: false, error: 'Failed to load user profile' }
      }

      userDetails = newUser
    }

    if (userError && !userDetails) {
      console.error('Error fetching user details:', userError.message)
      return { success: false, error: 'Failed to load user details' }
    }

    if (!userDetails) {
      return { success: false, error: 'User details not found' }
    }

    // Step 3: Check if user is active
    if (!(userDetails as any).is_active) {
      await supabase.auth.signOut()
      return { success: false, error: 'User account is inactive' }
    }

    // Step 4: Store in localStorage
    localStorage.setItem(
      'auth_state',
      JSON.stringify({
        user: userDetails,
        timestamp: Date.now(),
      })
    )

    return {
      success: true,
      user: userDetails as AuthUser,
    }
  } catch (error) {
    console.error('Login exception:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export const logoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error.message)
      return { success: false, error: error.message }
    }

    localStorage.removeItem('auth_state')
    return { success: true }
  } catch (error) {
    console.error('Logout exception:', error)
    return { success: false, error: 'Failed to logout' }
  }
}

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    // Check localStorage first (cache)
    const storedAuth = localStorage.getItem('auth_state')
    if (storedAuth) {
      const { user, timestamp } = JSON.parse(storedAuth)
      // Use cache if less than 1 hour old
      if (Date.now() - timestamp < 60 * 60 * 1000) {
        return user as AuthUser
      }
    }

    // Get session from Supabase
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      localStorage.removeItem('auth_state')
      return null
    }

    // Fetch user details - use maybeSingle to avoid errors on empty result
    const { data: userDetails, error } = await supabase
      .from('auth_users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user:', error.message)
      return null
    }

    if (!userDetails) {
      console.warn('User details not found for ID:', session.user.id)
      return null
    }

    // Update cache
    localStorage.setItem(
      'auth_state',
      JSON.stringify({
        user: userDetails,
        timestamp: Date.now(),
      })
    )

    return userDetails as AuthUser
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

export const isUserAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser()
    return user !== null
  } catch (error) {
    console.error('Auth check error:', error)
    return false
  }
}

export const hasRole = async (
  requiredRole: 'admin' | 'manager' | 'cashier' | 'inventory' | 'all'
): Promise<boolean> => {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return false
    }

    if (requiredRole === 'all') {
      return true
    }

    return user.role === requiredRole
  } catch (error) {
    console.error('Role check error:', error)
    return false
  }
}

export const hasAnyRole = async (allowedRoles: string[]): Promise<boolean> => {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return false
    }

    return allowedRoles.includes(user.role)
  } catch (error) {
    console.error('Role check error:', error)
    return false
  }
}
